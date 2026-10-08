import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {Route, routes, routeCoordinates} from '../data/routes';

export type MapHandle = {recenter: () => void};
type Props = {route: Route; reversed: boolean; onSelect: (id:string) => void; width: number; height: number};
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

export const RouteMap = forwardRef<MapHandle, Props>(function RouteMap({route, reversed, onSelect, width, height}, ref) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const coordinates = routeCoordinates(route, reversed);
  const fit = useCallback(() => {
    if (!ready || !laidOut) return;
    map.current?.fitToCoordinates(route.coordinates, {
      animated:true,
      edgePadding:{top:height*0.19, right:width*0.12, bottom:height*0.46, left:width*0.12},
    });
  },[ready,laidOut,route,width,height]);
  useImperativeHandle(ref, () => ({recenter:fit}), [fit]);
  useEffect(() => { const frame = requestAnimationFrame(fit); return () => cancelAnimationFrame(frame); },[fit,reversed]);
  const others = routes.filter(r => r.id !== route.id);
  return <View style={StyleSheet.absoluteFill}>
    <MapView ref={map} testID="interactive-map" style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={darkStyle} userInterfaceStyle="dark"
      initialRegion={{latitude:14.6234,longitude:121.1448,latitudeDelta:0.035,longitudeDelta:0.07}}
      onMapReady={() => setReady(true)} onLayout={() => setLaidOut(true)}
      scrollEnabled zoomEnabled rotateEnabled pitchEnabled
      showsTraffic={false} showsBuildings={false} toolbarEnabled={false}
      showsMyLocationButton={false} showsUserLocation={false}
      mapPadding={{top:0,left:0,right:0,bottom:height*0.405}}>
      {[...others,route].map((r,index) => <Polyline key={r.id} coordinates={r.coordinates}
        strokeColor={r.color} strokeWidth={index===2?5:index===0?13:9}
        zIndex={index+1} tappable onPress={() => onSelect(r.id)} />)}
      <Marker identifier="origin" coordinate={coordinates[0]} pinColor="#1d9ee3"
        title={`Origin: ${reversed?route.destination:route.origin}`}
        description="Sample starting point. Not your GPS location." />
      <Marker identifier="destination" coordinate={coordinates[coordinates.length-1]} pinColor="#7ed957"
        title={`Destination: ${reversed?route.origin:route.destination}`}
        description="Sample destination — tap a route to compare." />
      {routes.map((r,index) => <Marker key={r.id} identifier={r.id}
        coordinate={r.coordinates[8+index*5]} pinColor={r.color}
        onPress={() => onSelect(r.id)} title={`${r.label} · Sample`}
        description={`${r.transport} · ₱${r.fare} · ${r.minutes}mins · ${r.crowd} (not live)`} />)}
    </MapView>
  </View>;
});
