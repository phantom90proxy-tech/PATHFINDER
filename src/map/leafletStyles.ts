const STYLESHEET_ID = 'pathfinder-leaflet-styles';
export const STYLESHEET_TIMEOUT_MS = 10_000;

// Share pending work between mounted maps. Only the last pending consumer can
// cancel it; a successfully loaded stylesheet stays available across remounts.
export function createLeafletStylesLoader(doc: Document, timeoutMs = STYLESHEET_TIMEOUT_MS) {
  type Attempt = {
    link: HTMLLinkElement; promise: Promise<void>; consumers: number;
    settled: boolean; finish: (error?: Error) => void;
  };
  let current: Attempt | undefined;
  let attempts = 0;
  return {
    acquire() {
      let acquired = current;
      if (!current) {
        const link = doc.createElement('link');
        link.id = STYLESHEET_ID;
        link.rel = 'stylesheet';
        // A removed link can leave an HTTP request in flight. Give retries a
        // distinct URL so browsers cannot attach them to that stalled request.
        link.href = '/leaflet/leaflet.css' + (attempts++ ? `?attempt=${attempts}` : '');
        let resolve!: () => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<void>((yes, no) => {resolve = yes; reject = no;});
        const attempt: Attempt = {link, promise, consumers: 0, settled: false, finish: () => {}};
        acquired = attempt;
        current = attempt;
        const timer = setTimeout(() => attempt.finish(new Error('Leaflet styles timed out')), timeoutMs);
        attempt.finish = error => {
          if (attempt.settled) return;
          attempt.settled = true;
          clearTimeout(timer);
          link.onload = null;
          link.onerror = null;
          if (error) {
            link.remove();
            if (current === attempt) current = undefined;
            reject(error);
          } else resolve();
        };
        link.onload = () => attempt.finish();
        link.onerror = () => attempt.finish(new Error('Leaflet styles failed to load'));
        try {doc.head.append(link);} catch {attempt.finish(new Error('Leaflet styles could not be attached'));}
      }
      // Keep the failed attempt's promise even if append cleared the cache.
      const attempt = acquired!;
      attempt.consumers++;
      let released = false;
      return {promise: attempt.promise, release() {
        if (released) return;
        released = true;
        attempt.consumers--;
        if (!attempt.settled && !attempt.consumers) attempt.finish(new Error('Leaflet styles loading cancelled'));
      }};
    },
  };
}

let loader: ReturnType<typeof createLeafletStylesLoader> | undefined;
export function acquireLeafletStyles() {
  // Access document only after the web map mounts, never while rendering SSR.
  loader ??= createLeafletStylesLoader(document);
  return loader.acquire();
}
