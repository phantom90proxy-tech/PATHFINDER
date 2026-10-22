import React, {createContext, useContext, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {AppState, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Preference} from './data/routes';
import type {MapRoute, RoadRoute} from './data/roadRoutes';
import {isRoadRoute} from './data/roadRoutes';
import {createRecoveryStore} from './services/restartRecovery';
import {snapshotRoute} from './services/savedJourneys';
import {useCurrentLocation} from './hooks/useCurrentLocation';
import {createEndpointConfirmations} from './services/endpointConfirmations';
import {useSavedJourneys} from './hooks/useSavedJourneys';
import {useJourneyHistory} from './hooks/useJourneyHistory';
function useStateValues(){
  const [selected,setSelected]=useState('');
  const [origin,updateOrigin]=useState('');
  const [destination,updateDestination]=useState('');
  const [confirmationRevision, changedConfirmation] = useState(0);
  const [confirmations] = useState(() => createEndpointConfirmations(() => changedConfirmation(value => value + 1)));
  const [recoveryStore] = useState(() => createRecoveryStore(AsyncStorage));
  const recoveryStatus = useSyncExternalStore(recoveryStore.subscribe, recoveryStore.getSnapshot, recoveryStore.getSnapshot);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveredJourney, setRecoveredJourney] = useState<MapRoute | null>(null);
  const [rememberedJourney, setRememberedJourney] = useState<MapRoute | null>(null);
  const inputs = useRef({origin: '', destination: ''});
  const setOrigin = (query: string) => {confirmations.edit('origin', query); inputs.current.origin = query; updateOrigin(query);};
  const setDestination = (query: string) => {confirmations.edit('destination', query); inputs.current.destination = query; updateDestination(query);};
  const swapEndpoints = () => {
    confirmations.swap();
    inputs.current = {origin: inputs.current.destination, destination: inputs.current.origin};
    updateOrigin(inputs.current.origin); updateDestination(inputs.current.destination);
  };
  const [reversed,setReversed]=useState(false);
  const [preference,setPreference]=useState<Preference>('Cheapest');
  const [cleared,setCleared]=useState(false);
  const [mapMode,updateMapMode]=useState<'demo'|'driving'>('driving');
  const setMapMode = (mode: 'demo' | 'driving') => {setRecoveredJourney(null); updateMapMode(mode);};
  const [searchMode,setSearchMode]=useState<'demo'|'driving'>('driving');
  const [roadRoutes,setRoadRoutes]=useState<RoadRoute[]>([]);
  const [selectedRoad,setSelectedRoad]=useState('');
  const gps = useCurrentLocation();
  const savedJourneys = useSavedJourneys();
  const journeyHistory = useJourneyHistory();
  useEffect(() => {
    let active = true;
    void recoveryStore.load().then(data => {
      if (!active) return;
      for (const endpoint of ['origin', 'destination'] as const) {
        confirmations.edit(endpoint, data[endpoint].query);
        if (data[endpoint].place) confirmations.confirm(endpoint, data[endpoint].query, data[endpoint].place, () => true);
      }
      inputs.current = {origin: data.origin.query, destination: data.destination.query};
      updateOrigin(data.origin.query); updateDestination(data.destination.query);
      setPreference(data.preference); setSearchMode(data.searchMode); setCleared(data.cleared);
      setRememberedJourney(data.journey); setRecoveredJourney(data.journey);
      if (data.journey) {
        updateMapMode(isRoadRoute(data.journey) ? 'driving' : 'demo');
        if (isRoadRoute(data.journey)) {setRoadRoutes([data.journey]); setSelectedRoad(data.journey.id);}
        else setSelected(data.journey.id);
      }
      setRecoveryReady(true);
    });
    return () => {active = false; void recoveryStore.flush();};
  }, [recoveryStore, confirmations]);
  useEffect(() => {
    if (!recoveryReady) return;
    recoveryStore.update({version: 1, origin: {query: origin, place: confirmations.get('origin', origin)},
      destination: {query: destination, place: confirmations.get('destination', destination)},
      preference, searchMode, cleared, journey: rememberedJourney});
  }, [recoveryReady, recoveryStore, origin, destination, confirmations, confirmationRevision, preference, searchMode, cleared, rememberedJourney]);
  useEffect(() => {if (recoveryReady) void recoveryStore.flush();}, [recoveryReady, recoveryStore, rememberedJourney, confirmationRevision]);
  useEffect(() => {
    const flush = () => {void recoveryStore.flush();};
    const subscription = AppState.addEventListener('change', state => {if (state !== 'active') flush();});
    if (Platform.OS === 'web') {
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', flush);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush);}
    };
  }, [recoveryStore]);
  const rememberJourney = (route: MapRoute, reverse = false) => {setRememberedJourney(snapshotRoute(route, reverse));};
  const discardRecovery = async () => {
    await recoveryStore.clear();
    setOrigin(''); setDestination(''); setRememberedJourney(null); setRecoveredJourney(null);
    setSelected(''); setSelectedRoad(''); setRoadRoutes([]); setReversed(false); updateMapMode('driving');
    setPreference('Cheapest'); setSearchMode('driving'); setCleared(false);
  };
  return {selected,setSelected,origin,setOrigin,destination,setDestination,confirmations,swapEndpoints,reversed,setReversed,preference,setPreference,cleared,setCleared,
    mapMode,setMapMode,searchMode,setSearchMode,roadRoutes,setRoadRoutes,selectedRoad,setSelectedRoad,savedJourneys,journeyHistory,
    recoveryReady,recoveryError: recoveryStatus.error,recoveredJourney,rememberJourney,discardRecovery,...gps};
}
const Context=createContext<ReturnType<typeof useStateValues>|null>(null);
export function PrototypeState({children}:{children:React.ReactNode}){
  const value=useStateValues();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePrototype(){
  const value=useContext(Context);
  if(!value)throw new Error('PrototypeState provider missing');
  return value;
}
