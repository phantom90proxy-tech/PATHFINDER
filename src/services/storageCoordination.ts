export type StorageCoordination = {
  mutate<T>(key: string, work: () => Promise<T>): Promise<T>;
  subscribe(key: string, changed: () => void): () => void;
};

// Native/Node: coordinate stores in this JS runtime. This is not a native
// multi-process lock; independent native runtimes must not share these writers.
export function createInProcessStorageCoordination(): StorageCoordination {
  const queues = new Map<string, Promise<unknown>>();
  return {
    mutate<T>(key: string, work: () => Promise<T>) {
      const pending = (queues.get(key) ?? Promise.resolve()).then(work);
      const settled = pending.then(() => {}, () => {});
      queues.set(key, settled);
      void settled.then(() => {if (queues.get(key) === settled) queues.delete(key);});
      return pending;
    },
    subscribe: () => () => {},
  };
}
export const storageCoordination = createInProcessStorageCoordination();
