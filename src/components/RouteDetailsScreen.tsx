import {useTheme, useThemeStyles} from '../theme';
import React, {useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import {usePrototype} from '../PrototypeState';
import {routes} from '../data/routes';
import {isRoadRoute, snappingNotice, tripEndpoints} from '../data/roadRoutes';
import {fareForRoute, fareLabel} from '../services/fareInformation';
import {transportationInformation} from '../services/transportationInformation';
import {RouteMap, type MapHandle} from './RouteMap';
import {GoogleMapsButton} from './GoogleMapsButton';
import {SaveJourneyButton} from './SaveJourneyButton';
import {useReducedMotion} from '../hooks/useReducedMotion';

function Chevron({back = false}: {back?: boolean}) {
  const {mode} = useTheme();
  return <Svg accessible={false} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : '#9be570'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d={back ? 'M19 12H5m6-6-6 6 6 6' : 'm9 5 7 7-7 7'} /></Svg>;
}
export default function RouteDetailsScreen() {
  const s = useThemeStyles(baseStyles);
  const params = useLocalSearchParams<{id: string; mode: string; reversed: string; view?: string}>();
  const {roadRoutes, location, rememberJourney, journeyHistory} = usePrototype();
  const route = (params.mode === 'driving' ? roadRoutes : routes).find(item => item.id === params.id);
  const reversed = params.reversed === '1';
  const [directions, setDirections] = useState(false);
  const [mapWidth, setMapWidth] = useState(0);
  const [mapSize, setMapSize] = useState({width: 0, height: 0});
  const map = useRef<MapHandle>(null);
  const reduced = useReducedMotion();
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  const road = route ? isRoadRoute(route) : false;
  const endpoints = route ? tripEndpoints(route, reversed) : null;
  const info = route ? transportationInformation(route) : null;
  const minutes = route ? isRoadRoute(route) ? route.durationSeconds / 60 : route.minutes : 0;
  if ((params.view === 'map' || params.view === 'journey') && route) return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to route details" onPress={back} style={({pressed}) => [s.back, pressed && s.pressed]}><Chevron back /></Pressable><View style={s.heading}><Text style={s.eyebrow}>{params.view === 'journey' ? road ? 'DRIVING ESTIMATE' : 'TRANSIT DEMO · NOT LIVE' : 'EXPLORE YOUR JOURNEY'}</Text><Text accessibilityRole="header" style={s.title}>{params.view === 'journey' ? road ? 'Your Route' : 'Demo Route' : 'Route Map'}</Text></View></View>
    <View testID="route-map-viewer" style={s.fullMap} onLayout={({nativeEvent: {layout}}) => setMapSize(current => current.width === layout.width && current.height === layout.height ? current : {width: layout.width, height: layout.height})}>
      {mapSize.width > 0 && mapSize.height > 0 && <RouteMap ref={map} route={route} routes={[route]} reversed={reversed} location={location} onSelect={() => {}} width={mapSize.width} height={mapSize.height} overlays={{top: 24, bottom: 24}} reducedMotion={reduced} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Show entire route" onPress={() => map.current?.recenter()} style={({pressed}) => [s.fitButton, pressed && s.pressed]}><Text style={s.fitText}>Show entire route</Text></Pressable>
    </View>
    <Text style={s.mapHelp}>Drag to explore · Pinch or double-tap to zoom</Text>
    {params.view === 'journey' && <View style={s.journeyFooter}><Text style={s.value}>{endpoints?.origin} → {endpoints?.destination}</Text><Text style={s.note}>{road ? 'Estimated driving route. Open Google Maps for navigation.' : 'Demo route display. No live navigation or simulated GPS movement.'}</Text>{road && <GoogleMapsButton route={route} reversed={reversed} location={location} />}<Pressable accessibilityRole="button" accessibilityLabel="Finish route" onPress={() => router.dismissTo('/')} style={s.start}><Text style={s.startText}>Finish route</Text></Pressable></View>}
  </SafeAreaView>;
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to route results" onPress={back} style={({pressed}) => [s.back, pressed && s.pressed]}><Chevron back /></Pressable><View style={s.heading}><Text style={s.eyebrow}>YOUR NEXT JOURNEY</Text><Text accessibilityRole="header" style={s.title}>Route Details</Text></View></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {!route || !endpoints || !info ? <View style={s.summary}><Text style={s.value}>This route is no longer available.</Text><Text style={s.note}>Go back and find routes for your journey again.</Text></View> : <>
        <View style={s.summary}>
          <Text style={s.trip}>{endpoints.origin} - {endpoints.destination}</Text>
          <View style={s.grid}>
            {[['Time', Number.isFinite(minutes) && minutes > 0 ? `${Math.max(1, Math.round(minutes))} min` : 'Unavailable'], ['Fare', fareLabel(fareForRoute(route))], ['Transfers', road ? 'Unavailable' : info.transfers.classification === 'demo' ? String('transfers' in route ? route.transfers : '') : 'Unavailable'], ['Transport', road ? 'Driving' : 'transport' in route ? route.transport : 'Unavailable']].map(([label, value]) => <View key={label} style={s.metric}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
          </View>
          <Text style={s.note}>{road ? 'Estimated driving time (OSRM). No live traffic or transit fare data.' : 'Demo route · Sample travel time, fare, transfers and transport. Not live public transport.'}</Text>
        </View>
        <View style={s.map} onLayout={({nativeEvent: {layout}}) => setMapWidth(layout.width)}>
          {mapWidth > 0 && <RouteMap route={route} routes={[route]} reversed={reversed} location={location} onSelect={() => {}} width={mapWidth} height={200} overlays={{top: 20, bottom: 0}} reducedMotion={reduced} />}
          <Pressable accessibilityRole="button" accessibilityLabel="View route map" accessibilityHint="Opens a full screen map. Drag to explore and pinch to zoom." onPress={() => router.push({pathname: '/route-map', params: {id: route.id, mode: road ? 'driving' : 'demo', reversed: reversed ? '1' : '0', view: 'map'}})} style={s.mapTapArea}>
            <View style={s.mapBadge}><Text style={s.fitText}>Tap to explore map</Text><Chevron /></View>
          </Pressable>
        </View>
        <View style={s.directions}>
          <Pressable accessibilityRole="button" accessibilityLabel="How to get there?" accessibilityState={{expanded: directions}} onPress={() => setDirections(value => !value)} style={({pressed}) => [s.directionsButton, pressed && s.pressed]}><Text style={s.value}>How to get there?</Text><View style={directions ? {transform: [{rotate: '90deg'}]} : undefined}><Chevron /></View></Pressable>
          {directions && <View style={s.steps}><Text style={s.value}>From {endpoints.origin}</Text><Text style={s.note}>{road ? 'Use Google Maps for turn-by-turn driving directions. Its route may differ from this preview.' : `${info.mode.label}. Verified stops and boarding instructions are unavailable for this demo.`}</Text><Text style={s.value}>To {endpoints.destination}</Text>{snappingNotice(route) && <Text style={s.note}>{snappingNotice(route)}</Text>}<GoogleMapsButton route={route} reversed={reversed} location={location} /></View>}
        </View>
        <View style={s.actions}>
          <SaveJourneyButton route={route} reversed={reversed} variant="details" />
          <Pressable accessibilityRole="button" accessibilityLabel="Start Route" accessibilityHint="Opens a separate journey map" onPress={() => {
            rememberJourney(route, reversed);
            void journeyHistory.store.record(route, reversed).catch(() => {});
            router.push({pathname: '/route-map', params: {id: route.id, mode: road ? 'driving' : 'demo', reversed: reversed ? '1' : '0', view: 'journey'}});
          }} style={({pressed}) => [s.start, pressed && s.pressed]}><Text style={s.startText}>Start Route</Text></Pressable>
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#000000'},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16},
  back: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#1c2620', alignItems: 'center', justifyContent: 'center'},
  heading: {flex: 1},
  eyebrow: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.6, color: '#91a096', marginBottom: 5},
  title: {fontFamily: 'Inter_600SemiBold', fontSize: 25, letterSpacing: -0.8, color: '#f2f6f0'},
  content: {padding: 16, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 24},
  summary: {backgroundColor: '#19221c', borderWidth: 1, borderColor: '#334039', borderRadius: 20, padding: 16, gap: 16},
  trip: {fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24, color: '#edf3ea'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#334039'},
  metric: {width: '50%', paddingRight: 10, gap: 5},
  label: {fontFamily: 'Inter_500Medium', fontSize: 11, color: '#99a89d'},
  value: {fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22, color: '#edf3ea', flexShrink: 1},
  note: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d'},
  map: {height: 200, borderRadius: 20, overflow: 'hidden', backgroundColor: '#19221c'},
  mapTapArea: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 24, alignItems: 'flex-end', justifyContent: 'flex-start', padding: 12},
  mapBadge: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#19221cf2', borderWidth: 1, borderColor: '#425343', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8},
  fullMap: {flex: 1, overflow: 'hidden'},
  journeyFooter: {padding: 16, gap: 12, borderTopWidth: 1, borderColor: '#334039', backgroundColor: '#19221c'},
  fitButton: {position: 'absolute', top: 16, right: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#19221cf2', borderWidth: 1, borderColor: '#425343', borderRadius: 16},
  fitText: {fontFamily: 'Inter_500Medium', fontSize: 12, color: '#9be570'},
  mapHelp: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d', textAlign: 'center', padding: 12},
  directions: {borderRadius: 16, backgroundColor: '#19221c', borderWidth: 1, borderColor: '#303d34', overflow: 'hidden'},
  directionsButton: {minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  steps: {padding: 16, paddingTop: 0, gap: 12}, actions: {gap: 12},
  start: {minHeight: 54, borderRadius: 16, backgroundColor: '#9be570', alignItems: 'center', justifyContent: 'center', padding: 14},
  startText: {fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#172510'}, pressed: {opacity: 0.7},
});
