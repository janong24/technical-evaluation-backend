export interface StorageConnectionConfig {
    host: string;
    port: number;
    db: number;
    fileTTLSeconds: number;
    tls: boolean;
}

export type StoredValue = string | Buffer;

export interface StorageBackend {
    verifyChecksum: (key: string) => Promise<string>;

    get: (key: string) => Promise<string | null>;

    getBuffer: (key: string) => Promise<Buffer | null>;

    set: (key: string, value: StoredValue) => Promise<void>;

    // List methods
    rPush: (key: string, value: StoredValue) => Promise<void>;
    getListAll: (key: string) => Promise<string[]>;

    keys: (pattern: string) => Promise<string[]>;
}
