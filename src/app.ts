import { container } from "tsyringe";
import { FileStorageToken, StorageBackendToken } from "./ioc-tokens";
import { AppFileStorage } from "./file-storage/file-storage";
import { TestStorageBackend } from "./file-storage/storage-backend/test-backend";

export function getAppContainer() {
    const appContainer = container.createChildContainer();
    
    appContainer.register(FileStorageToken, AppFileStorage);
    appContainer.register(StorageBackendToken, TestStorageBackend);

    return appContainer;
}
