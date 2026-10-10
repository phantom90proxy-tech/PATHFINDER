import React, {createContext, useContext, useState} from 'react';
import {Preference} from './data/routes';
import type {RoadRoute} from './data/roadRoutes';
import {useCurrentLocation} from './hooks/useCurrentLocation';
function useStateValues(){
  const [selected,setSelected]=useState('');
  const [origin,setOrigin]=useState('');
  const [destination,setDestination]=useState('');
  const [reversed,setReversed]=useState(false);
  const [preference,setPreference]=useState<Preference>('Cheapest');
  const [cleared,setCleared]=useState(false);
  const [mapMode,setMapMode]=useState<'demo'|'driving'>('driving');
  const [searchMode,setSearchMode]=useState<'demo'|'driving'>('driving');
  const [roadRoutes,setRoadRoutes]=useState<RoadRoute[]>([]);
  const [selectedRoad,setSelectedRoad]=useState('');
  const gps = useCurrentLocation();
  return {selected,setSelected,origin,setOrigin,destination,setDestination,reversed,setReversed,preference,setPreference,cleared,setCleared,
    mapMode,setMapMode,searchMode,setSearchMode,roadRoutes,setRoadRoutes,selectedRoad,setSelectedRoad,...gps};
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
