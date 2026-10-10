// Identity matters: one successful tile must not clear another tile's error.
export function createTileFailures<T>(now = Date.now) {
  const failed = new Set<T>();
  let nextRetry = 0;
  return {
    fail(tile: T) {failed.add(tile);},
    loaded(tile: T) {failed.delete(tile);},
    unloaded(tile: T) {failed.delete(tile);},
    count: () => failed.size,
    retry(reload: (tile: T) => void) {
      if (now() < nextRetry || !failed.size) return false;
      nextRetry = now() + 5000;
      [...failed].forEach(reload);
      return true;
    },
    clear() {failed.clear();},
  };
}
