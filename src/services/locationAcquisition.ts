import type {LocationFix} from '../data/roadRoutes';

type Permission = {granted: boolean; canAskAgain: boolean};
type Provider = {
  permission: () => Promise<Permission>;
  servicesEnabled: () => Promise<boolean>;
  position: () => Promise<LocationFix>;
};
export function createLocationAcquisition(provider: Provider, timeoutMs = 25000) {
  let pending = false;
  return async (): Promise<LocationFix> => {
    if (pending) throw new Error('The previous location request is still finishing. Respond to any permission prompt and wait before retrying.');
    pending = true;
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutError = () => new Error('Location timed out. Check the permission prompt and GPS settings, then retry when the previous request finishes.');
    const check = () => {if (expired) throw timeoutError();};
    const work = (async () => {
      try {
        const permission = await provider.permission(); check();
        if (!permission.granted) throw new Error(permission.canAskAgain ? 'Location permission was denied. You can still enter coordinates or choose a known place.' : 'Location is blocked. Enable it in app or browser settings, or choose a known place.');
        const enabled = await provider.servicesEnabled(); check();
        if (!enabled) throw new Error('Location services are off. Enable GPS in your device settings.');
        const fix = await provider.position(); check();
        if (!Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 || !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180 || !Number.isFinite(fix.timestamp)) throw new Error('GPS returned an invalid position. Please retry.');
        return {...fix, accuracy: fix.accuracy !== null && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 ? fix.accuracy : null};
      } finally {
        // Expo's one-shot call cannot be cancelled. Keep the lock until it settles,
        // even if the UI deadline has already expired. Late fixes are discarded.
        pending = false;
      }
    })();
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {expired = true; reject(timeoutError());}, timeoutMs);
      })]);
    } finally {if (timer) clearTimeout(timer);}
  };
}
