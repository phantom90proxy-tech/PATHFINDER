import React from 'react';
import {ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import {isRoadRoute, routeLabel, snappingNotice, type MapRoute} from '../data/roadRoutes';
import {useReducedMotion} from '../hooks/useReducedMotion';
import type {Place} from '../services/placeSearch';
import {GoogleMapsButton} from './GoogleMapsButton';
import {usePrototype} from '../PrototypeState';

export type DiscoveryPhase = 'places' | 'loading' | 'results' | 'compare' | 'error' | null;
type Props = {
  phase: DiscoveryPhase; origin: string; destination: string; driving: boolean;
  routes: MapRoute[]; selected: string; reversed: boolean; cached: boolean;
  notice: string | null; preference: string;
  places?: {endpoint: string; choices: Place[]; onChoose: (place: Place) => void};
  onBack: () => void; onClose: () => void; onRetry: () => void;
  onSelect: (id: string) => void; onShowMap: () => void;
};

// Scoped to discovery. Values match the approved Plan Your Ride palette and type scale.
const GREEN = '#9be570';
function Glyph({check = false}: {check?: boolean}) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})}>
    <Path d={check ? 'm5 12 4 4L19 6' : 'M19 12H5m6-6-6 6 6 6'} />
  </Svg>;
}
function Action({label, onPress, primary = false}: {label: string; onPress: () => void; primary?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed}) => [s.action, primary && s.primary, pressed && s.pressed]}>
    <Text style={[s.actionText, primary && s.primaryText]}>{label}</Text>
  </Pressable>;
}

export function RouteDiscovery(props: Props) {
  const {phase, origin, destination, driving, routes, selected, reversed, cached, notice, preference, onBack, onClose, onRetry, onSelect, onShowMap} = props;
  const reduced = useReducedMotion();
  const {location} = usePrototype();
  const insets = useSafeAreaInsets();
  const comparing = phase === 'compare';
  const empty = phase === 'error' && /No driving route|no usable routes|Only SM City/i.test(notice ?? '');
  const title = phase === 'places' ? 'Confirm location' : phase === 'loading' ? 'Find routes' : phase === 'error' ? (empty ? 'No routes found' : 'Routes unavailable') : comparing ? 'Compare routes' : 'Route results';
  const chosen = routes.find(route => route.id === selected);
  const snap = chosen ? snappingNotice(chosen) : null;
  return <Modal visible={phase !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onBack}>
    <View style={[s.backdrop, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
      <View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={title} style={s.sheet} testID="route-discovery">
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={phase === 'loading' ? 'Back to map' : comparing ? 'Back to route results' : 'Back to Plan your ride'} onPress={onBack} style={({pressed}) => [s.back, pressed && s.pressed]}><Glyph /></Pressable>
          <View style={s.grow}><Text style={s.eyebrow}>YOUR NEXT JOURNEY</Text><Text accessibilityRole="header" style={s.title}>{title}</Text></View>
        </View>
        <ScrollView key={phase} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.trip}>
            <Text style={s.eyebrow}>FROM</Text><Text testID="discovery-origin" style={s.endpoint}>{origin.trim() || 'Choose an origin'}</Text>
            <View style={s.divider} />
            <Text style={s.eyebrow}>TO</Text><Text testID="discovery-destination" style={s.endpoint}>{destination.trim() || 'Choose a destination'}</Text>
          </View>
          {phase === 'places' && props.places ? <View style={s.cards}>
            <Text style={s.copy}>Choose your {props.places.endpoint}. Check the city and address before continuing.</Text>
            {props.places.choices.map((place, index) => <Action key={index} label={place.label} onPress={() => props.places?.onChoose(place)} />)}
            <Text style={s.meta}>Location search: Photon ? ? OpenStreetMap contributors</Text>
          </View> : phase === 'loading' ? <View style={s.state}>
            {!reduced && <ActivityIndicator size="small" color={GREEN} />}
            <Text role="status" accessibilityLiveRegion="polite" style={s.section}>Finding driving routes…</Text>
            <Text style={s.copy}>Resolving your stops and checking roads. This may take a few seconds.</Text>
            <Text style={s.meta}>You can go back while the request finishes.</Text>
          </View> : phase === 'error' ? <View style={s.state}>
            <Text accessibilityRole="alert" style={s.copy}>{notice}</Text>
            {driving && !empty && <Action label="Retry routes" onPress={onRetry} primary />}
          </View> : <>
            <View style={s.intro}>
              <Text style={s.section}>{routes.length === 1 ? '1 route available' : `${routes.length} routes available`}</Text>
              <Text style={s.copy}>{comparing ? 'Tap a route to select it and view it on the map.' : 'Choose a route for your journey.'}</Text>
              {routes.length === 1 && <Text style={s.meta}>No alternatives were returned for this journey.</Text>}
              <Text style={s.meta}>{driving ? (cached ? 'Cached OSRM estimates (up to 5 minutes old). ' : 'OSRM driving estimates. ') + 'No live traffic, fares or crowd data. These are car routes, not public transport.' : 'Demo data · Sample travel times, fares and crowd levels. Not live public transport.'}</Text>
            </View>
            <View style={s.cards}>{routes.map((route, index) => {
              const road = isRoadRoute(route), active = route.id === selected;
              const label = routeLabel(route, reversed);
              return <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={`Select ${label}`} accessibilityState={{selected: active}} aria-pressed={active} onPress={() => {onSelect(route.id); if (comparing) onShowMap();}}
                style={({pressed}) => [s.card, active && s.selected, pressed && s.pressed]}>
                <View style={s.cardHeading}><Text style={s.routeName}>{label}</Text>{active && <Glyph check />}</View>
                <Text style={s.duration}>{road ? Math.max(1, Math.round(route.durationSeconds / 60)) : route.minutes}<Text style={s.unit}> min</Text></Text>
                <Text style={s.meta}>{road ? `${(route.distanceMeters / 1000).toFixed(1)} km · Driving route` : `${route.transport} · Demo data`}</Text>
                <Text style={s.meta}>{road ? 'Estimated travel time' : `Sample fare ₱${route.fare} · ${route.crowd}`}</Text>
                {!road && comparing && <Text style={s.meta}>Distance not provided · {route.transfers} {route.transfers === 1 ? 'transfer' : 'transfers'}</Text>}
                {!road && index === 0 && <Text style={s.accent}>Best for {preference.toLowerCase()}</Text>}
                <Text style={[s.selection, active && s.accent]}>{active ? 'Selected route' : 'Tap to select route'}</Text>
              </Pressable>;
            })}</View>
            {snap && <Text style={s.copy}>{snap}</Text>}
            {chosen && phase === 'results' && <View style={s.actions}>
              <Action label="View selected route on map" onPress={onShowMap} primary />
              <GoogleMapsButton route={chosen} reversed={reversed} location={location} />
            </View>}
          </>}
          {phase === 'error' && <Action label="Edit journey" onPress={onClose} />}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: '#000000'},
  sheet: {flex: 1, width: '100%', backgroundColor: '#000000', overflow: 'hidden'},
  header: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 16},
  back: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#1c2620', alignItems: 'center', justifyContent: 'center'},
  grow: {flex: 1, minWidth: 220, maxWidth: '100%'}, eyebrow: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.6, color: '#91a096', marginBottom: 5},
  title: {fontFamily: 'Inter_600SemiBold', fontSize: 25, letterSpacing: -0.8, color: '#f2f6f0'},
  content: {padding: 16, gap: 16, paddingBottom: 24}, trip: {borderRadius: 16, padding: 16, backgroundColor: '#19221c', borderWidth: 1, borderColor: '#334039'},
  endpoint: {fontFamily: 'Inter_500Medium', fontSize: 15, color: '#f1f6ee'}, divider: {height: 1, backgroundColor: '#334039', marginVertical: 12},
  intro: {gap: 8}, section: {fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#edf3ea'},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#b6c1b9'},
  meta: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d'},
  cards: {gap: 12}, card: {padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#303d34', backgroundColor: '#19221c', gap: 6},
  selected: {borderColor: '#6f9e53', backgroundColor: '#253722'}, cardHeading: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  routeName: {flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#e5ede2'},
  duration: {fontFamily: 'Inter_600SemiBold', fontSize: 32, color: '#f2f6f0', marginTop: 4}, unit: {fontSize: 16, color: '#b6c1b9'},
  selection: {fontFamily: 'Inter_500Medium', fontSize: 12, color: '#b6c1b9', marginTop: 6}, accent: {fontFamily: 'Inter_500Medium', fontSize: 12, color: GREEN},
  state: {paddingVertical: 24, gap: 16}, actions: {gap: 10}, action: {minHeight: 48, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#19221c', borderWidth: 1, borderColor: '#303d34'},
  primary: {backgroundColor: GREEN, minHeight: 54, borderColor: GREEN}, actionText: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#c3cec5', textAlign: 'center'}, primaryText: {fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#172510'}, pressed: {opacity: 0.7},
});
