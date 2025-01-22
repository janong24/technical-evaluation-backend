import { ReadStream } from 'node:fs';
import type { ReadableStream } from 'node:stream/web';
import { inject, injectable } from 'tsyringe';

import { StorageBackend } from './storage-backend/storage-backend';
import { StorageBackendToken } from '../ioc-tokens';

export interface FileStorage {
    /**
     * Upload file should handle a web standards ReadableStream and put the file into the storage backend.
     *
     * Note: parallel is a "bonus" feature that should control the number of parallel requests made to the
     * storage backend
     */
    uploadFile(
        fileStream: ReadableStream<Uint8Array> | ReadStream,
        fileName: string,
        chunkSize: number,
        _parallel?: number
    ): Promise<void>;

    /**
     * Download file should return the full file that was uploaded by the given `fileName` as a Buffer.
     *
     * Note: parallel is a "bonus" feature that should control the number of parallel requests made to the
     * storage backend
     */
    downloadFile(fileName: string, _parallel?: number): Promise<Buffer>;

    /**
     * List uploaded files is primarily used in unit tests and would be a method for debugging. Therefore, it
     * does not need to be highly performant (for example might use `SCAN` or `KEYS` with a redis implementation).
     */
    listUploadedFiles(): Promise<string[]>;
}

@injectable()
export class AppFileStorage implements FileStorage {
    constructor(@inject(StorageBackendToken) private backend: StorageBackend) {
        console.log('TODO: implement AppFileStorage', this.backend);
    }

    public async uploadFile(
        _fileStream: ReadableStream<Uint8Array> | ReadStream,
        _fileName: string,
        _chunkSize: number,
        _parallel: number
    ): Promise<void> {}

    public async downloadFile(fileName: string, _parallel: number): Promise<Buffer> {
        throw new Error(`File ${fileName} not found`);
    }

    public async listUploadedFiles(): Promise<string[]> {
        return [];
    }
}
