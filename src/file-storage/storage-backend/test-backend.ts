import { injectable } from 'tsyringe';
import { computeChecksum } from '../helpers';
import { StorageBackend, StoredValue } from './storage-backend';

@injectable()
export class TestStorageBackend implements StorageBackend {
    private store: Record<string, StoredValue> = {};

    private listStore: Record<string, StoredValue[]> = {};

    constructor() {}

    async verifyChecksum(key: string): Promise<string> {
        const value = this.store[key];
        if (!value) {
            throw new Error(`Key not found: ${key}`);
        }

        // Simulate checksum calculation (e.g., SHA-1)
        const data = typeof value === 'string' ? Buffer.from(value) : value;
        const checksum = computeChecksum(data);
        return checksum;
    }

    async get(key: string): Promise<string | null> {
        console.log('TestBackend - Getting string:', key);
        const value = this.store[key];
        console.log('TestBackend - Retrieved string:', key, value);
        if (!value) {
            console.log('TestBackend - Key not found in store. Current keys:', Object.keys(this.store));
        }
        return typeof value === 'string' ? value : null;
    }

    async getBuffer(key: string): Promise<Buffer | null> {
        console.log('TestBackend - Getting buffer:', key);
        const value = this.store[key];
        console.log('TestBackend - Retrieved buffer:', key, value instanceof Buffer ? `Buffer(${value.length})` : value);
        if (!value) {
            console.log('TestBackend - Key not found in store. Current keys:', Object.keys(this.store));
        }
        return Buffer.isBuffer(value) ? value : null;
    }

    async getListAll(key: string): Promise<string[]> {
        const retrievedList = this.listStore[key] || [];
        return retrievedList.map((storedVal) => {
            if (storedVal instanceof Buffer) {
                return storedVal.toString('utf8');
            }
            return storedVal;
        });
    }

    async set(key: string, value: StoredValue): Promise<void> {
        console.log('TestBackend - Setting:', key, value instanceof Buffer ? `Buffer(${value.length})` : value);
        this.store[key] = value;
        // Log store contents after each set
        console.log('TestBackend - Store contents after set:', 
            Object.entries(this.store).map(([k, v]) => 
                `${k}: ${v instanceof Buffer ? `Buffer(${v.length})` : v}`
            )
        );
    }

    async rPush(key: string, value: StoredValue): Promise<void> {
        setTimeout(() => {
            const existingList = this.listStore[key] || [];
            this.listStore[key] = [...existingList, value];
        }, 0);
    }

    async keys(pattern: string): Promise<string[]> {
        const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
        return Object.keys(this.store).filter((key) => regex.test(key));
    }
}
