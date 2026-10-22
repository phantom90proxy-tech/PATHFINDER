import {useEffect, useState, useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createJourneyHistoryStore} from '../services/journeyHistory';
import {storageCoordination} from '../services/storageCoordination';

export function useJourneyHistory() {
  const [store] = useState(() => createJourneyHistoryStore(AsyncStorage, Date.now, storageCoordination));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {const stop = store.watch(); void store.load().catch(() => {}); return stop;}, [store]);
  return {state, store};
}
