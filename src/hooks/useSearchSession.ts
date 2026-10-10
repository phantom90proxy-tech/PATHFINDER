import {createContext, useCallback, useEffect, useState} from 'react';
import {useFocusEffect, useNavigation} from 'expo-router';
import {createSearchSession} from '../services/searchSession';

export const SearchSessionContext = createContext<ReturnType<typeof createSearchSession> | null>(null);
export function useSearchSession() {
  const [session] = useState(createSearchSession);
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => {
    session.activate();
    return () => session.exit();
  }, [session]));
  useEffect(() => navigation.addListener('beforeRemove', () => session.exit()), [navigation, session]);
  return session;
}
