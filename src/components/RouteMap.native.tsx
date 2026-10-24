import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {useTheme} from '../theme';
import {isRoadRoute, routeSummary, routeLabel, tripEndpoints} from '../data/roadRoutes';
import {mapViewport} from '../data/mapViewport';
import type {MapHandle, RouteMapProps as Props} from './RouteMap.types';
export type {MapHandle, RouteMapProps} from './RouteMap.types';

const darkStyle = [
  {elementType:'geometry',stylers:[{color:'#080f10'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#8dd8af'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#080f10'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#253432'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#405851'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#00534d'}]},
  {featureType:'poi.park',elementType:'geometry',stylers:[{color:'#072811'}]},
  {featureType:'poi.business',stylers:[{visibility:'off'}]},
];

export const RouteMap = forwardRef<MapHandle, Props>(function RouteMap({route, routes, location, reversed, onSelect, width, height, overlays, reducedMotion = false}, ref) {
  const {mode} = useTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const coordinates = route ? reversed && !isRoadRoute(route) ? [...route.coordinates].reverse() : route.coordinates : [];
  const endpoints = route ? tripEndpoints(route, reversed) : null;
  const fit = useCallback(() => {
    if (!ready || !laidOut || !route) return;
    map.current?.fitToCoordinates(route.coordinates, {
      animated:!reducedMotion,
      edgePadding:mapViewport(width,height,overlays).edgePadding,
    });
  },[ready,laidOut,route,width,height,overlays,reducedMotion]);
  useImperativeHandle(ref, () => ({recenter:fit, centerOnLocation: point => map.current?.animateToRegion({...point, latitudeDelta: 0.01, longitudeDelta: 0.01}, reducedMotion ? 0 : 400)}), [fit, reducedMotion]);
  useEffect(() => { const frame = requestAnimationFrame(fit); return () => cancelAnimationFrame(frame); },[fit,reversed]);
  const others = routes.filter(r => r.id !== route?.id);
  return <View style={StyleSheet.absoluteFill}>
    <MapView ref={map} testID="interactive-map" style={StyleSheet.absoluteFill}
      customMapStyle={mode === 'dark' ? darkStyle : []} userInterfaceStyle={mode}
      initialRegion={{latitude:14.6234,longitude:121.1448,latitudeDelta:0.035,longitudeDelta:0.07}}
      onMapReady={() => setReady(true)} onLayout={() => setLaidOut(true)}
      scrollEnabled zoomEnabled rotateEnabled pitchEnabled
      moveOnMarkerPress={false}
      showsTraffic={false} showsBuildings={false} toolbarEnabled={false}
      showsMyLocationButton={false} showsUserLocation={false}
      mapPadding={mapViewport(width,height,overlays).mapPadding}>
      {(route ? [...others,route] : others).map((r,index) => <Polyline key={r.id} coordinates={r.coordinates}
        strokeColor={isRoadRoute(r) ? (r.id === route?.id ? '#7ed957' : '#8b969088') : r.color} strokeWidth={r.id === route?.id ? 5 : isRoadRoute(r) ? 4 : index===0?13:9}
        zIndex={index+1} tappable onPress={() => onSelect(r.id)} />)}
      {route && endpoints && <><Marker identifier="origin" coordinate={coordinates[0]} pinColor="#1d9ee3"
        title={`Origin: ${endpoints.origin}`}
        description={isRoadRoute(route) ? 'Road-snapped driving origin' : 'Demo starting point. Not your GPS location.'} />
      <Marker identifier="destination" coordinate={coordinates[coordinates.length-1]} pinColor="#7ed957"
        title={`Destination: ${endpoints.destination}`}
        description={isRoadRoute(route) ? 'Road-snapped driving destination. No live traffic.' : 'Demo destination — tap a route to compare.'} /></>}
      {routes.map((r,index) => <Marker key={r.id} identifier={r.id}
        coordinate={r.coordinates[Math.min(r.coordinates.length - 1, isRoadRoute(r) ? Math.floor(r.coordinates.length * (0.35 + index * 0.15)) : 8+index*5)]} pinColor={r.color}
        onPress={() => onSelect(r.id)} title={`${routeLabel(r, reversed)} · ${isRoadRoute(r) ? 'Driving' : 'Sample'}`}
        description={routeSummary(r)} />)}
      {location && <Marker identifier="gps" coordinate={location} pinColor="#259cff" title="Your GPS position" description={`Last fix: ${new Date(location.timestamp).toLocaleTimeString()}`} />}
    </MapView>
  </View>;
});
