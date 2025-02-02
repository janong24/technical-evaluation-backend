import { ReadStream } from 'node:fs';
import type { ReadableStream } from 'node:stream/web';
import { inject, injectable } from 'tsyringe';

import { StorageBackend } from './storage-backend/storage-backend';
import { StorageBackendToken } from '../ioc-tokens';
import { computeChecksum } from './helpers';

// CONSTANTS
const FILE_LIST_KEY = 'uploaded_files';
const CHUNK_PREFIX = 'chunk:';
const METADATA_PREFIX = 'meta:';
const MAX_CHUNK_SIZE = 512 * 1024 *1024; // 512MB (valkey limit)
const MEMORY_THRESHOLD = 0.9; // 90% of memory usage

interface FileMetadata {
    _fileName: string;
    totalChunks: number;
    _chunkSize: number;
    totalSize: number;
    checksum: string;
    createdAt: number;
}

export interface FileStorage {
    /**
     * Upload file should handle a web standards ReadableStream and put the file into the storage backend.
     * 
     * Chunk size is a parameter that should be used to determine the size of "chunks" of the file to store in
     * the storagebackend.
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
    constructor(@inject(StorageBackendToken) private backend: StorageBackend) {}

    private async checkMemoryUsage(): Promise<void> {
        const usage = process.memoryUsage();
        const heapRatio = usage.heapUsed / usage.heapTotal;
        
        if (heapRatio > MEMORY_THRESHOLD) {
            throw new Error('Memory usage too high, try again later');
        }
    }

    public async uploadFile(
        _fileStream: ReadableStream<Uint8Array> | ReadStream,
        _fileName: string,
        _chunkSize: number,
        _parallel: number
    ): Promise<void> {
        // Validate chunk size
        if (_chunkSize > MAX_CHUNK_SIZE) {
            throw new Error(`Chunk size cannot exceed ${MAX_CHUNK_SIZE} bytes`);
        }

        // Get reader from stream
        const reader = 'getReader' in _fileStream 
            ? _fileStream.getReader() 
            : createWebStreamReader(_fileStream as ReadStream);

        let totalSize = 0;
        let chunkIndex = 0;
        const allData: Buffer[] = [];

        try {
            while (true) {
                await this.checkMemoryUsage();
                
                const { done, value } = await reader.read();
                
                if (value) {
                    const chunk = Buffer.from(value);
                    allData.push(chunk);
                    totalSize += chunk.length;
                }
                
                if (done) break;
            }

            // Combine all data and compute checksum
            const completeBuffer = Buffer.concat(allData);
            const checksum = computeChecksum(completeBuffer);
            console.log('Upload - Original data length:', completeBuffer.length);
            console.log('Upload - Computed checksum:', checksum);
            console.log('Upload - First few bytes:', completeBuffer.slice(0, 20));

            // Split into chunks
            const chunks: Buffer[] = [];
            for (let i = 0; i < completeBuffer.length; i += _chunkSize) {
                chunks.push(completeBuffer.slice(i, Math.min(i + _chunkSize, completeBuffer.length)));
            }

            // Store chunks with parallel processing
            const pendingWrites: Promise<void>[] = [];

            for (let i = 0; i < chunks.length; i++) {  // Using regular for loop
                const writePromise = this.backend.set(
                    `${CHUNK_PREFIX}${_fileName}:${i}`,
                    chunks[i]
                );
                pendingWrites.push(writePromise);
                
                // Update metadata count
                chunkIndex = i + 1;
                
                if (pendingWrites.length >= _parallel) {
                    await Promise.all(pendingWrites.splice(0, _parallel));
                }
            }

            // Store metadata
            const metadata: FileMetadata = {
                _fileName,
                totalChunks: chunks.length,
                _chunkSize,
                totalSize,
                checksum,
                createdAt: Date.now()
            };
            
            await this.backend.set(
                `${METADATA_PREFIX}${_fileName}`,
                JSON.stringify(metadata)
            );
            
            // Add to file list
            await this.backend.rPush(FILE_LIST_KEY, _fileName);
            await new Promise(resolve => setTimeout(resolve, 0));
            
        } catch (error) {
            // Attempt cleanup on failure
            for (let i = 0; i < chunkIndex; i++) {
                try {
                    await this.backend.set(`${CHUNK_PREFIX}${_fileName}:${i}`, Buffer.alloc(0));
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
            }
            throw error;
        }
    }

    public async downloadFile(fileName: string, _parallel: number = 1): Promise<Buffer> {
        // Ensure parallel is at least 1
        const parallel = Math.max(1, _parallel || 1);
        
        await this.checkMemoryUsage();
    
        console.log('Download - Starting for:', fileName);
        console.log('Download - Looking for metadata at:', `${METADATA_PREFIX}${fileName}`);
    
        // Get metadata
        const metaStr = await this.backend.get(`${METADATA_PREFIX}${fileName}`);
        if (!metaStr) {
            throw new Error(`File ${fileName} not found`);
        }
        console.log('Download - Raw metadata string:', metaStr);
    
        const metadata: FileMetadata = JSON.parse(metaStr);
        console.log('Download - Parsed metadata:', metadata);
    
        // Verify metadata fields
        if (!metadata.totalChunks || metadata.totalChunks <= 0) {
            throw new Error('Invalid chunk count in metadata');
        }
        console.log(`Download - Will attempt to get ${metadata.totalChunks} chunks`);
    
        const chunks: Buffer[] = [];
    
        try {
            console.log('Download - Starting chunk retrieval loop');
            const totalChunks = metadata.totalChunks;
            let currentChunk = 0;
    
            // Download chunks with parallel processing
            while (currentChunk < totalChunks) {
                await this.checkMemoryUsage();
                
                // Ensure we don't exceed total chunks
                const remainingChunks = totalChunks - currentChunk;
                const batchSize = Math.min(parallel, remainingChunks);
                const batchEnd = currentChunk + batchSize;
    
                if (batchSize <= 0) {
                    break;
                }
    
                console.log(`Download - Processing batch from ${currentChunk} to ${batchEnd - 1}`);
                
                // Create batch of parallel requests
                const batchPromises = [];
                for (let i = currentChunk; i < batchEnd; i++) {
                    const chunkKey = `${CHUNK_PREFIX}${fileName}:${i}`;
                    console.log('Download - Requesting chunk:', chunkKey);
                    batchPromises.push(
                        (async () => {
                            const chunk = await this.backend.getBuffer(chunkKey);
                            if (!chunk) {
                                throw new Error(`Chunk ${i} missing for ${fileName}`);
                            }
                            return { index: i, data: chunk };
                        })()
                    );
                }
                
                // Process batch results
                const batchResults = await Promise.all(batchPromises);
                batchResults.sort((a, b) => a.index - b.index);
                
                // Store chunks in order
                for (const { data } of batchResults) {
                    if (!data || data.length === 0) {
                        throw new Error(`Empty chunk received for ${fileName}`);
                    }
                    chunks.push(data);
                }
    
                currentChunk = batchEnd;
            }
            
            // Combine chunks and verify checksum
            const completeBuffer = Buffer.concat(chunks);
            
            if (completeBuffer.length === 0) {
                throw new Error(`No data retrieved for ${fileName}`);
            }
    
            const downloadedChecksum = computeChecksum(completeBuffer);
            console.log('Download - Retrieved data length:', completeBuffer.length);
            console.log('Download - Computed checksum:', downloadedChecksum);
            console.log('Download - Expected checksum:', metadata.checksum);
            console.log('Download - First few bytes:', completeBuffer.slice(0, 20));
            
            if (downloadedChecksum !== metadata.checksum) {
                throw new Error(`Checksum mismatch for ${fileName}. Expected ${metadata.checksum} but got ${downloadedChecksum}`);
            }
            
            return completeBuffer;
            
        } catch (error) {
            // Clear chunks array to free memory
            chunks.length = 0;
            throw error;
        }
    }

    public async listUploadedFiles(): Promise<string[]> {
        return await this.backend.getListAll(FILE_LIST_KEY);
    }
}

// Helper function for Node.js ReadStream
function createWebStreamReader(nodeStream: ReadStream) {
    return {
        async read(): Promise<{ done: boolean; value?: Uint8Array }> {
            return new Promise((resolve, reject) => {
                nodeStream.once('data', (chunk) => {
                    // Ensure chunk is converted to Uint8Array
                    const value = Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : new Uint8Array(Buffer.from(chunk));
                    resolve({ done: false, value });
                });
                
                nodeStream.once('end', () => {
                    resolve({ done: true });
                });
                
                nodeStream.once('error', (err) => {
                    reject(err);
                });
            });
        }
    };
}