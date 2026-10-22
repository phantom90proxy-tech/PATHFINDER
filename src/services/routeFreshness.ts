const MINUTE = 60_000;

export function routeAgeMs(fetchedAt: unknown, now: number): number | null {
  return typeof fetchedAt === 'number' && Number.isFinite(fetchedAt) && fetchedAt > 0 &&
    Number.isFinite(now) && now >= fetchedAt ? now - fetchedAt : null;
}

export function routeFreshnessLabel(fetchedAt: unknown, cached: boolean, now = Date.now()) {
  const source = cached ? 'Cached OSRM estimates. ' : 'Fetched OSRM driving estimates. ';
  const age = routeAgeMs(fetchedAt, now);
  if (age === null) return source + 'Data age unavailable.';
  const minutes = Math.floor(age / MINUTE);
  const elapsed = minutes === 0 ? 'less than 1 minute' : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  return source + `Data retrieved ${elapsed} ago.` +
    (age >= 5 * MINUTE ? ' Outside the 5-minute cache window. Search again to refresh.' : '');
}

// Schedule only the next displayed minute boundary, using wall-clock time so
// missed/background timers never make old data appear newly retrieved.
export function createFreshnessClock(fetchedAt: unknown, update: () => void, {
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  let active = false, disposed = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = (version: number) => {
    if (!active || disposed || version !== generation) return;
    update();
    const age = routeAgeMs(fetchedAt, now());
    timer = schedule(() => tick(version), age === null ? MINUTE : MINUTE - age % MINUTE);
  };
  return {
    setActive(value: boolean) {
      if (disposed) return;
      generation++;
      cancel(timer); timer = undefined;
      active = value;
      if (active) tick(generation);
    },
    dispose() {disposed = true; active = false; cancel(timer); timer = undefined;},
  };
}
