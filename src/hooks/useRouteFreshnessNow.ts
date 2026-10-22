import {useEffect, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {createFreshnessClock} from '../services/routeFreshness';

export function useRouteFreshnessNow(fetchedAt: unknown) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const clock = createFreshnessClock(fetchedAt, () => setNow(Date.now()));
    if (Platform.OS === 'web') {
      const resume = () => clock.setActive(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', resume);
      window.addEventListener('pageshow', resume);
      window.addEventListener('focus', resume);
      resume();
      return () => {
        clock.dispose();
        document.removeEventListener('visibilitychange', resume);
        window.removeEventListener('pageshow', resume);
        window.removeEventListener('focus', resume);
      };
    }
    const subscription = AppState.addEventListener('change', state => clock.setActive(state === 'active'));
    clock.setActive(AppState.currentState === 'active' || AppState.currentState === null);
    return () => {clock.dispose(); subscription.remove();};
  }, [fetchedAt]);
  return now;
}
