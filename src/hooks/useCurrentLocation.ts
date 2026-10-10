import {useCallback, useRef, useState} from 'react';
import * as Location from 'expo-location';
import type {LocationFix} from '../data/roadRoutes';
import {createLocationAcquisition} from '../services/locationAcquisition';

const acquire = createLocationAcquisition({
  permission: () => Location.requestForegroundPermissionsAsync(),
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  position: async () => {
    const result = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false});
    return {latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, timestamp: result.timestamp};
  },
});

export function useCurrentLocation() {
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const pending = useRef(false);
  const locate = useCallback(async (): Promise<LocationFix | null> => {
    if (pending.current) return null;
    pending.current = true; setLocating(true); setLocationError(null);
    try {
      const fix = await acquire();
      setLocation(fix);
      return fix;
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Location unavailable. Check GPS and permissions, then retry.');
      return null;
    } finally {pending.current = false; setLocating(false);}
  }, []);
  return {location, locating, locationError, locate};
}
