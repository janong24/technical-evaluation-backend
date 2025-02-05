import { describe, it, beforeEach } from 'vitest';
import { ReadableStream } from 'node:stream/web';
import { AppFileStorage, FileStorage } from './file-storage';
import { StorageBackend } from './storage-backend/storage-backend';
import { TestStorageBackend } from './storage-backend/test-backend';

function* stringToByteIterable(str: string, chunkSize: number): Generator<Uint8Array, void, undefined> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);

    for (let i = 0; i < encoded.length; i += chunkSize) {
        // Ensure no padding by slicing only the available bytes
        yield encoded.subarray(i, Math.min(i + chunkSize, encoded.length));
    }
}

async function stringToReadableStream(
    str: string,
    chunkSize: number = Number.MAX_SAFE_INTEGER
): Promise<ReadableStream<Uint8Array>> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of stringToByteIterable(str, chunkSize)) {
                controller.enqueue(chunk);
            }
            controller.close();
        },
    });
}

describe('FileStorage', () => {
    let backend: StorageBackend;
    let fileStorage: FileStorage;

    beforeEach(async () => {
        backend = new TestStorageBackend();
        fileStorage = new AppFileStorage(backend);
    });

    it('should allow uploading a file and list it afterward', async ({ expect }) => {
        const fileName = 'testFile.txt';

        const fileContent = 'This is a test file for abstract testing';
        const fileReadable = await stringToReadableStream(fileContent);

        await fileStorage.uploadFile(fileReadable, fileName, 1024);

        const uploadedFiles = await fileStorage.listUploadedFiles();
        expect(uploadedFiles).toContain(fileName);
    });

    it('should download a previously uploaded file and match its content', async ({ expect }) => {
        const fileName = 'testFile.txt';
        const fileContent = 'This is a test file for download functionality.';
        const fileReadable = await stringToReadableStream(fileContent);
        // Upload the file
        await fileStorage.uploadFile(fileReadable, fileName, 256);

        // Wait a moment to ensure all data is saved
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Download the file to a new location
        const downloadedBuffer = await fileStorage.downloadFile('testFile.txt');
        const downloadedContent = downloadedBuffer.toString('utf8');

        expect(downloadedContent).toBe(fileContent);
    });

    it('should list all uploaded files', async ({ expect }) => {
        const files = ['file1.txt', 'file2.txt', 'file3.txt'];

        for (const fileName of files) {
            const fileReadable = await stringToReadableStream(`Content for ${fileName}`);
            await fileStorage.uploadFile(fileReadable, fileName, 1024);
        }

        const uploadedFiles = await fileStorage.listUploadedFiles();
        expect(uploadedFiles).toEqual(expect.arrayContaining(files));
    });

    it('should throw an error when downloading a non-existent file', async ({ expect }) => {
        await expect(fileStorage.downloadFile('nonExistentFile.txt')).rejects.toThrow(
            /File nonExistentFile.txt not found/
        );
    });
});

// additional tests
describe('Edge Cases', () => {
    let backend: StorageBackend;
    let fileStorage: FileStorage;

    beforeEach(async () => {
        backend = new TestStorageBackend();
        fileStorage = new AppFileStorage(backend);
    });

    it('should handle zero parallel value', async ({ expect }) => {
        const fileName = 'zero-parallel-test.txt';
        const content = 'Test content for zero parallel';
        const fileReadable = await stringToReadableStream(content);

        await fileStorage.uploadFile(fileReadable, fileName, 1024, 0);
        const downloaded = await fileStorage.downloadFile(fileName, 0);

        expect(downloaded.toString()).toBe(content);
    });

    it('should handle negative parallel value', async ({ expect }) => {
        const fileName = 'negative-parallel-test.txt';
        const content = 'Test content for negative parallel';
        const fileReadable = await stringToReadableStream(content);

        await fileStorage.uploadFile(fileReadable, fileName, 1024, -1);
        const downloaded = await fileStorage.downloadFile(fileName, -1);

        expect(downloaded.toString()).toBe(content);
    });

    it('should handle concurrent access to same file', async ({ expect }) => {
        const fileName = 'concurrent-test.txt';
        const content = 'Test content for concurrent access';
        const fileReadable = await stringToReadableStream(content);

        // Upload file
        await fileStorage.uploadFile(fileReadable, fileName, 1024, 1);

        // Attempt concurrent downloads
        const downloads = await Promise.all([
            fileStorage.downloadFile(fileName, 1),
            fileStorage.downloadFile(fileName, 1),
        ]);

        // Verify all downloads match
        downloads.forEach((downloaded) => {
            expect(downloaded.toString()).toBe(content);
        });
    });

    it('should handle high parallel value', async ({ expect }) => {
        const fileName = 'high-parallel-test.txt';
        const content = 'Test content for high parallel processing';
        const fileReadable = await stringToReadableStream(content);

        await fileStorage.uploadFile(fileReadable, fileName, 1024, 50);
        const downloaded = await fileStorage.downloadFile(fileName, 50);

        expect(downloaded.toString()).toBe(content);
    });
});

describe('Metadata and Audit Trail', () => {
    let backend: StorageBackend;
    let fileStorage: FileStorage;

    beforeEach(async () => {
        backend = new TestStorageBackend();
        fileStorage = new AppFileStorage(backend);
    });

    it('should store correct file metadata on upload', async ({ expect }) => {
        const fileName = 'patient-scan.dat';
        const content = 'Test medical data content';
        const fileReadable = await stringToReadableStream(content);
        const chunkSize = 1024;

        // Record upload time
        const uploadStartTime = Date.now();
        await fileStorage.uploadFile(fileReadable, fileName, chunkSize, 1);

        // Get metadata directly from backend
        const metaStr = await backend.get(`meta:${fileName}`);
        expect(metaStr).not.toBeNull();

        const metadata = JSON.parse(metaStr!);

        // Verify all required metadata fields exist
        expect(metadata).toHaveProperty('_fileName', fileName);
        expect(metadata).toHaveProperty('totalChunks');
        expect(metadata).toHaveProperty('_chunkSize', chunkSize);
        expect(metadata).toHaveProperty('totalSize');
        expect(metadata).toHaveProperty('checksum');
        expect(metadata).toHaveProperty('createdAt');

        // Verify timestamps are reasonable
        expect(metadata.createdAt).toBeGreaterThanOrEqual(uploadStartTime);
        expect(metadata.createdAt).toBeLessThanOrEqual(Date.now());

        // Verify size matches content
        expect(metadata.totalSize).toBe(Buffer.from(content).length);
    });

    it('should maintain a list of all uploaded files', async ({ expect }) => {
        const files = ['scan1.dat', 'scan2.dat', 'scan3.dat'];
        const uploadTimes = [];

        // Upload multiple files
        for (const fileName of files) {
            const fileReadable = await stringToReadableStream(`Content for ${fileName}`);
            uploadTimes.push(Date.now());
            await fileStorage.uploadFile(fileReadable, fileName, 1024, 1);
        }

        // Verify all files are listed
        const uploadedFiles = await fileStorage.listUploadedFiles();
        for (const fileName of files) {
            expect(uploadedFiles).toContain(fileName);
        }

        // Verify each file has valid metadata
        for (let i = 0; i < files.length; i++) {
            const metaStr = await backend.get(`meta:${files[i]}`);
            const metadata = JSON.parse(metaStr!);
            expect(metadata.createdAt).toBeGreaterThanOrEqual(uploadTimes[i]);
        }
    });

    it('should ensure metadata integrity across operations', async ({ expect }) => {
        const fileName = 'integrity-test.dat';
        const content = 'Test content for metadata integrity';
        const fileReadable = await stringToReadableStream(content);

        // Upload file
        await fileStorage.uploadFile(fileReadable, fileName, 1024, 1);

        // Get initial metadata
        const initialMetaStr = await backend.get(`meta:${fileName}`);
        const initialMeta = JSON.parse(initialMetaStr!);

        // Download file
        await fileStorage.downloadFile(fileName, 1);

        // Verify metadata hasn't changed after download
        const finalMetaStr = await backend.get(`meta:${fileName}`);
        const finalMeta = JSON.parse(finalMetaStr!);

        expect(finalMeta).toEqual(initialMeta);
    });

    it('should maintain consistent chunk references', async ({ expect }) => {
        const fileName = 'chunk-ref-test.dat';
        const content = 'Test content for chunk reference verification';
        const fileReadable = await stringToReadableStream(content);

        await fileStorage.uploadFile(fileReadable, fileName, 1024, 1);

        // Get metadata to know number of chunks
        const metaStr = await backend.get(`meta:${fileName}`);
        const metadata = JSON.parse(metaStr!);

        // Verify all chunks exist
        for (let i = 0; i < metadata.totalChunks; i++) {
            const chunkData = await backend.getBuffer(`chunk:${fileName}:${i}`);
            expect(chunkData).not.toBeNull();
            expect(chunkData!.length).toBeGreaterThan(0);
        }

        // Verify no extra chunks exist
        const extraChunkData = await backend.getBuffer(`chunk:${fileName}:${metadata.totalChunks}`);
        expect(extraChunkData).toBeNull();
    });
});
