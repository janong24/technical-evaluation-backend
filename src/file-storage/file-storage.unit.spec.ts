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
        await new Promise(resolve => setTimeout(resolve, 100));

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
