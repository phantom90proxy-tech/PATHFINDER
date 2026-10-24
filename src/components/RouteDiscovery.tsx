import {useTheme, useThemeStyles} from '../theme';
import React from 'react';
import {router, useFocusEffect} from 'expo-router';
import {rankRoadRoutes, roadRouteComparison, validEstimate} from '../services/roadRouteRanking';
import {ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import {isRoadRoute, routeLabel, snappingNotice, type MapRoute} from '../data/roadRoutes';
import {useReducedMotion} from '../hooks/useReducedMotion';
import type {Place} from '../services/placeSearch';
import {useRouteFreshnessNow} from '../hooks/useRouteFreshnessNow';
import {routeFreshnessLabel} from '../services/routeFreshness';
import {transitAvailability} from '../data/transitAvailability';
import {fareForRoute, fareLabel, fareDisclosure, demoFareDifference} from '../services/fareInformation';
import {crowdingForRoute, crowdingLabel, demoCrowdingComparison, transferLabel, transportationInformation, serviceInformationDisclosure} from '../services/transportationInformation';

export type DiscoveryPhase = 'places' | 'loading' | 'results' | 'compare' | 'error' | null;
type Props = {
  phase: DiscoveryPhase; origin: string; destination: string; driving: boolean;
  routes: MapRoute[]; selected: string; reversed: boolean; cached: boolean;
  notice: string | null; preference: string;
  places?: {endpoint: string; choices: Place[]; onChoose: (place: Place) => void};
  onBack: () => void; onClose: () => void; onRetry: () => void;
  onSelect: (id: string) => void;
};

// Scoped to discovery. Values match the approved Plan Your Ride palette and type scale.
const GREEN = '#9be570';
function Glyph({check = false}: {check?: boolean}) {
  const {mode} = useTheme();
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : GREEN} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})}>
    <Path d={check ? 'm5 12 4 4L19 6' : 'M19 12H5m6-6-6 6 6 6'} />
  </Svg>;
}
function Action({label, onPress, primary = false}: {label: string; onPress: () => void; primary?: boolean}) {
  const s = useThemeStyles(baseStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed}) => [s.action, primary && s.primary, pressed && s.pressed]}>
    <Text style={[s.actionText, primary && s.primaryText]}>{label}</Text>
  </Pressable>;
}

function RoadFreshness({fetchedAt, cached}: {fetchedAt: number | undefined; cached: boolean}) {
  const s = useThemeStyles(baseStyles);
  const now = useRouteFreshnessNow(fetchedAt);
  return <Text testID="route-freshness" style={s.meta}>{routeFreshnessLabel(fetchedAt, cached, now)} No live traffic, fares or crowd data. These are car routes, not public transport.</Text>;
}

export function RouteDiscovery(props: Props) {
  const s = useThemeStyles(baseStyles);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  useFocusEffect(React.useCallback(() => {setDetailsOpen(false);}, []));
  const {phase, origin, destination, driving, routes, selected, reversed, cached, notice, preference, onBack, onClose, onRetry, onSelect} = props;
  const reduced = useReducedMotion();
  const informationId = React.useId();
  const insets = useSafeAreaInsets();
  const comparing = phase === 'compare';
  const empty = phase === 'error' && /No driving route|no usable routes|Only SM City/i.test(notice ?? '');
  const title = phase === 'places' ? 'Confirm location' : phase === 'loading' ? 'Find routes' : phase === 'error' ? (empty ? 'No routes found' : 'Routes unavailable') : comparing ? 'Compare routes' : 'Route results';
  const roadAlternatives = routes.filter(isRoadRoute);
  const displayedRoutes = driving ? rankRoadRoutes(roadAlternatives) : routes;
  const chosen = routes.find(route => route.id === selected);
  const fares = routes.map(fareForRoute);
  const snap = chosen ? snappingNotice(chosen) : null;
  // Normally all alternatives share one fetch. For mixed/invalid data, report
  // the oldest timestamp or an unknown age rather than overstate freshness.
  const roadTimestamps = routes.filter(isRoadRoute).map(route => route.fetchedAt);
  const fetchedAt = roadTimestamps.length && roadTimestamps.every(time => typeof time === 'number' && Number.isFinite(time) && time > 0)
    ? Math.min(...roadTimestamps) : undefined;
  return <Modal visible={phase !== null && !detailsOpen} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onBack}>
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
            <Text style={s.meta}>Location search: Photon · © OpenStreetMap contributors.</Text>
          </View> : phase === 'loading' ? <View style={s.state}>
            {!reduced && <ActivityIndicator size="small" color={GREEN} />}
            <Text role="status" accessibilityLiveRegion="polite" style={s.section}>Finding driving routes…</Text>
            <Text style={s.copy}>Resolving your stops and checking roads. This may take a few seconds.</Text>
            <Text style={s.meta}>Going back cancels this search.</Text>
          </View> : phase === 'error' ? <View style={s.state}>
            <Text accessibilityRole="alert" style={s.copy}>{notice}</Text>
            {driving && !empty && <Action label="Retry routes" onPress={onRetry} primary />}
          </View> : <>
            <View style={s.intro}>
              <Text style={s.section}>{routes.length === 1 ? '1 route available' : `${routes.length} routes available`}</Text>
              <Text style={s.copy}>Tap a route to view its details.</Text>
              {routes.length === 1 && <Text style={s.meta}>No alternatives were returned for this journey.</Text>}
              {!driving && <Text style={s.meta}>{transitAvailability.demoDisclosure}</Text>}
              {!driving && <Text style={s.meta}>{fareDisclosure}</Text>}
              <Text style={s.meta}>{serviceInformationDisclosure}</Text>
              {driving ? (phase === 'results' || phase === 'compare') && <RoadFreshness key={String(fetchedAt)} fetchedAt={fetchedAt} cached={cached} /> : <Text style={s.meta}>Demo data · Sample travel times, fares and crowd levels. Not live public transport.</Text>}
            </View>
            <View style={s.cards}>{displayedRoutes.map((route, index) => {
              const road = isRoadRoute(route), active = route.id === selected;
              const comparison = road ? roadRouteComparison(route, roadAlternatives) : null;
              const label = routeLabel(route, reversed);
              return <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={`Select ${label}`} accessibilityHint={`Opens route details. ${transportationInformation(route).travelTime.label}.`} {...(Platform.OS === 'web' ? {'aria-describedby': `${informationId}-${index}`} : {})} accessibilityState={{selected: active}} aria-pressed={active} onPress={() => {onSelect(route.id); setDetailsOpen(true); router.push({pathname: '/route-details', params: {id: route.id, mode: driving ? 'driving' : 'demo', reversed: reversed ? '1' : '0'}});}}
                style={({pressed}) => [s.card, active && s.selected, pressed && s.pressed]}>
                <View style={s.cardHeading}><Text style={s.routeName}>{road ? label : `Demo service: ${label}`}</Text>{active && <Glyph check />}</View>
                {comparison && comparison.badges.length > 0 && <Text style={s.accent}>{comparison.badges.join(' / ')}</Text>}
                <Text style={s.duration}>{validEstimate(road ? route.durationSeconds : route.minutes) ? road ? Math.max(1, Math.round(route.durationSeconds / 60)) : route.minutes : 'Unavailable'}<Text style={s.unit}>{validEstimate(road ? route.durationSeconds : route.minutes) ? ' min' : ''}</Text></Text>
                <Text style={s.meta}>{road ? `${validEstimate(route.distanceMeters) ? (route.distanceMeters / 1000).toFixed(1) + ' km' : 'Distance unavailable'} · Driving route` : transportationInformation(route).mode.label}</Text>
                <Text nativeID={`${informationId}-${index}`} style={s.meta}>{fareLabel(fareForRoute(route))} · {crowdingLabel(crowdingForRoute(route))}</Text>
                <Text style={s.meta}>{transportationInformation(route).travelTime.label}</Text>
                {!road && demoFareDifference(fareForRoute(route), fares) && <Text style={s.meta}>{demoFareDifference(fareForRoute(route), fares)}</Text>}
                {comparison && comparison.differences.map(text => <Text key={text} style={s.meta}>{text}</Text>)}
                {!road && comparing && <Text style={s.meta}>Distance not provided · {transferLabel(route)}</Text>}
                {!road && preference === 'Less Crowded' && demoCrowdingComparison(crowdingForRoute(route), routes.map(crowdingForRoute)) && <Text style={s.accent}>Lowest demo crowding</Text>}
                {!road && index === 0 && preference === 'Fastest' && <Text style={s.accent}>Fastest demo travel time</Text>}
                <Text style={[s.selection, active && s.accent]}>{active ? 'Selected route · View details' : 'Tap to view route details'}</Text>
              </Pressable>;
            })}</View>
            {snap && <Text style={s.copy}>{snap}</Text>}
          </>}
          {phase === 'error' && <Action label="Edit journey" onPress={onClose} />}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const baseStyles = StyleSheet.create({
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
  state: {paddingVertical: 24, gap: 16}, action: {minHeight: 48, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#19221c', borderWidth: 1, borderColor: '#303d34'},
  primary: {backgroundColor: GREEN, minHeight: 54, borderColor: GREEN}, actionText: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#c3cec5', textAlign: 'center'}, primaryText: {fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#172510'}, pressed: {opacity: 0.7},
});
