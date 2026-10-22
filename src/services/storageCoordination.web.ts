import type {StorageCoordination} from './storageCoordination.ts';

export const storageLockName = (key: string) => `pathfinder.storage:${key}`;
const unavailable = () => new Error('Safe cross-tab storage coordination is unavailable. No changes were saved. Use a browser with Web Locks on HTTPS or localhost, then retry.');

// No browser globals are read during module initialization or native execution.
// Timeout only lock acquisition: never release a lock while its write is running.
export function createWebStorageCoordination(getWindow: () => Window = () => window, waitMs = 5000): StorageCoordination {
  return {
    async mutate<T>(key: string, work: () => Promise<T>): Promise<T> {
      let acquired = false, timer: ReturnType<typeof setTimeout> | undefined;
      const abort = new AbortController();
      try {
        const locks = getWindow().navigator.locks;
        if (!locks?.request) throw unavailable();
        timer = setTimeout(() => abort.abort(), waitMs);
        const result = await locks.request(storageLockName(key), {mode: 'exclusive', signal: abort.signal}, async () => {
          acquired = true; clearTimeout(timer);
          return work();
        });
        if (!acquired) throw unavailable();
        return result;
      } catch (error) {
        if (acquired) throw error;
        if (abort.signal.aborted) throw new Error('Storage is busy in another tab. No changes were saved. Retry shortly.');
        throw unavailable();
      } finally {clearTimeout(timer);}
    },
    subscribe(key: string, changed: () => void) {
      let target: Window;
      try {target = getWindow();} catch {return () => {};}
      const storage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        try {if (event.storageArea === target.localStorage) changed();} catch {/* Reads report storage failures through the store. */}
      };
      const resume = () => {if (target.document.visibilityState !== 'hidden') changed();};
      target.addEventListener('storage', storage);
      target.addEventListener('focus', resume);
      target.addEventListener('pageshow', resume);
      target.document.addEventListener('visibilitychange', resume);
      return () => {
        target.removeEventListener('storage', storage);
        target.removeEventListener('focus', resume);
        target.removeEventListener('pageshow', resume);
        target.document.removeEventListener('visibilitychange', resume);
      };
    },
  };
}
export const storageCoordination = createWebStorageCoordination();
