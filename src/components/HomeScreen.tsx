import {rankRoadRoutes, roadRouteComparison} from '../services/roadRouteRanking';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {router, Stack} from 'expo-router';
import Svg, {Circle, Path} from 'react-native-svg';
import {RouteMap, type MapHandle} from './RouteMap';
import {routes} from '../data/routes';
import {isRoadRoute, routeSummary, routeLabel, tripTitle, snappingNotice} from '../data/roadRoutes';
import {usePrototype} from '../PrototypeState';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {GoogleMapsButton} from './GoogleMapsButton';
import {SaveJourneyButton} from './SaveJourneyButton';
import {transitAvailability} from '../data/transitAvailability';
import {fareDisclosure, fareForRoute, demoFareDifference} from '../services/fareInformation';
import {serviceInformationDisclosure, transferLabel} from '../services/transportationInformation';

const GREEN = '#7ed957';
type Glyph = 'search' | 'arrow' | 'target' | 'info' | 'pin' | 'clock' | 'chevron' | 'menu' | 'profile';
function Icon({name, color = '#edf2ed', size = 22}: {name: Glyph; color?: string; size?: number}) {
  const paths: Record<Glyph, string> = {
    search: 'm16 16 5 5', arrow: 'M5 12h14m-6-6 6 6-6 6',
    target: 'M12 2v3m0 14v3M2 12h3m14 0h3', info: 'M12 11v6m0-10v.1',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z',
    clock: 'M12 7v5l3 2', chevron: 'm8 10 4 4 4-4',
    menu: 'M4 6h16M4 12h16M4 18h16', profile: 'M4 21v-2a8 8 0 0 1 16 0v2',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {name === 'search' && <Circle cx={10.5} cy={10.5} r={6.5} />}
    {['target', 'info', 'clock'].includes(name) && <Circle cx={12} cy={12} r={name === 'target' ? 7 : 9} />}
    {name === 'target' && <Circle cx={12} cy={12} r={2} />}
    {name === 'pin' && <Circle cx={12} cy={10} r={2} />}
    {name === 'profile' && <Circle cx={12} cy={7} r={4} />}
    <Path d={paths[name]} />
  </Svg>;
}
function Button({label, onPress, children, style, reduced, selected, expanded, hint, describedBy}: {
  label: string; onPress: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>;
  reduced: boolean; selected?: boolean; expanded?: boolean; hint?: string; describedBy?: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (value: number) => {
    scale.stopAnimation();
    Animated.timing(scale, {toValue: value, duration: reduced ? 0 : 120, useNativeDriver: Platform.OS !== 'web'}).start();
  };
  return <Animated.View style={[style, {transform: [{scale}]}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} {...(Platform.OS === 'web' ? {'aria-describedby': describedBy} : {})} accessibilityState={{selected, expanded}} aria-pressed={selected} aria-expanded={expanded}
      onPress={onPress} onPressIn={() => animate(0.97)} onPressOut={() => animate(1)}
      style={({pressed}) => [s.button, {opacity: pressed ? 0.76 : 1}]}>{children}</Pressable>
  </Animated.View>;
}

export function HomeScreen({width, height}: {width: number; height: number}) {
  const {journeyHistory, rememberJourney, recoveredJourney, recoveryError, discardRecovery} = usePrototype();
  const {selected, setSelected, reversed: activeReversed, mapMode, setMapMode, roadRoutes, selectedRoad, setSelectedRoad, location, locationError, locate, locating} = usePrototype();
  const reversed = recoveredJourney ? false : activeReversed;
  const informationId = React.useId();
  const rankedRoadRoutes = useMemo(() => rankRoadRoutes(roadRoutes), [roadRoutes]);
  const displayedRoutes = recoveredJourney ? [recoveredJourney] : mapMode === 'driving' ? rankedRoadRoutes : selected ? routes : [];
  const route = displayedRoutes.find(item => item.id === (mapMode === 'driving' ? selectedRoad : selected)) ?? null;
  const map = useRef<MapHandle>(null);
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<'menu' | 'profile' | null>(null);
  const [details, setDetails] = useState(false);
  const [gpsNotice, setGpsNotice] = useState(false);
  const [gpsRequested, setGpsRequested] = useState(false);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (!gpsRequested || locating) return;
    const timer = setTimeout(() => setGpsRequested(false), 6000);
    return () => clearTimeout(timer);
  }, [gpsRequested, locating]);
  const sheetHeight = Math.min(160, height * 0.45);
  const overlays = useMemo(() => ({top: 84, bottom: sheetHeight + 24}), [sheetHeight]);
  const search = () => router.push('/search');
  const select = (id: string) => {
    const chosen = displayedRoutes.find(item => item.id === id);
    if (!chosen) return;
    if (id === route?.id) map.current?.recenter(); else if (mapMode === 'driving') setSelectedRoad(id); else setSelected(id);
    void journeyHistory.store.record(chosen, mapMode === 'demo' && reversed).catch(() => {});
    rememberJourney(chosen, mapMode === 'demo' && reversed);
  };
  return <View style={s.fill}>
    <Stack.Screen options={{animation: reduced ? 'none' : 'fade'}} />
    <RouteMap ref={map} width={width} height={height} route={route} routes={displayedRoutes} location={location} reversed={mapMode === 'demo' && reversed} onSelect={select} overlays={overlays} reducedMotion={reduced} />
    <View pointerEvents="box-none" style={s.top}>
      <Button reduced={reduced} label="Open menu" onPress={() => setPanel('menu')} style={s.topIcon}><Icon name="menu" /></Button>
      <Button reduced={reduced} label="Open profile" onPress={() => setPanel('profile')} style={s.topIcon}><Icon name="profile" color={GREEN} /></Button>
    </View>
    {(recoveredJourney || recoveryError) && <View style={{position: 'absolute', top: 72, left: 16, right: 16, padding: 10, borderRadius: 10, backgroundColor: '#19221cee'}}>
      <Text accessibilityLiveRegion="polite" style={s.subtitle}>{recoveryError ?? 'Restored journey — previously retrieved information. Estimates may be outdated; no live traffic, fares or crowding. Discard from Menu.'}</Text>
    </View>}
    {gpsRequested && <View pointerEvents="none" style={{position: 'absolute', top: 68, left: 16, right: 16, alignItems: 'center'}}>
      <Text role="status" accessibilityLiveRegion="polite" style={[s.subtitle, {backgroundColor: '#19221cee', borderRadius: 10, padding: 10}]}>
        {locating ? 'Getting your location…' : locationError ? 'Location unavailable. Open Menu to retry.' : location ? 'Location updated' : ''}
      </Text>
    </View>}
    <Animated.View pointerEvents="box-none" style={[s.floating, {bottom: sheetHeight + 40}]}>
      <View pointerEvents="none" style={s.sampleBadge}><View style={s.dot} /><Text style={s.sampleText}>{!route ? 'CHOOSE YOUR JOURNEY' : isRoadRoute(route) ? 'DRIVING ESTIMATE · NO LIVE TRAFFIC' : 'TRANSIT DEMO · NOT LIVE'}</Text></View>
      <Button reduced={reduced} label="Recenter selected route" onPress={() => map.current?.recenter()} style={s.recenter}><Icon name="target" /></Button>
    </Animated.View>
    <Animated.View testID="home-sheet" style={[s.sheet, {height: sheetHeight, width: Math.min(width - 20, 600), left: (width - Math.min(width - 20, 600)) / 2}]}>
      <View style={s.handleContainer}><View style={s.handle} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
        <Text accessibilityRole="header" style={s.greeting}>Hello, Your Name</Text>
        <Button reduced={reduced} label="Where to? Search routes" onPress={search} style={s.search}>
          <Icon name="search" color={GREEN} /><View style={s.grow}><Text numberOfLines={1} style={s.searchTitle}>Where to?</Text><Text numberOfLines={1} style={s.subtitle}>Find your next ride</Text></View>
        </Button>
      </ScrollView>
    </Animated.View>
    <Modal visible={details} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setDetails(false)}>
      <View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
        <Text accessibilityRole="header" style={s.heading}>Route details & alternatives</Text>
        <ScrollView style={{maxHeight: height * 0.5}}>
          {!route && <Text style={s.notice}>Search for a journey to see route details.</Text>}
          {route && <><Text style={s.notice}>{tripTitle(route, reversed)}</Text>
          <GoogleMapsButton route={route} reversed={reversed} location={location} />
          <SaveJourneyButton route={route} reversed={mapMode === 'demo' && reversed} />
          {!isRoadRoute(route) && <Text style={s.subtitle}>{transitAvailability.demoDisclosure}</Text>}
          {!isRoadRoute(route) && <Text style={s.subtitle}>{fareDisclosure}</Text>}
          <Text style={s.subtitle}>{serviceInformationDisclosure}</Text>
          {!isRoadRoute(route) && <Text style={s.subtitle}>{transferLabel(route)}</Text>}
          {snappingNotice(route) && <Text style={s.notice}>{snappingNotice(route)}</Text>}
          <Text style={s.subtitle}>{isRoadRoute(route) ? `OSRM driving estimate from ${new Date(route.fetchedAt).toLocaleTimeString()}. No live traffic, transit service, fare or crowd estimates. Alternatives are not guaranteed.` : 'Public-transport demo data. Geometry, times, fares and crowd levels are predefined samples.'}</Text>
          {displayedRoutes.map((item, index) => {
            const comparison = isRoadRoute(item) ? roadRouteComparison(item, displayedRoutes.filter(isRoadRoute)) : null;
            const comparisonText = comparison ? [...comparison.badges, ...comparison.differences].join(' / ') : '';
            const fareDifference = !isRoadRoute(item) ? demoFareDifference(fareForRoute(item), displayedRoutes.map(fareForRoute)) : null;
            return <Button key={item.id} reduced={reduced} label={`Show ${routeLabel(item, reversed)}`} hint={routeSummary(item)} describedBy={`${informationId}-${index}`} selected={item.id === route?.id} onPress={() => select(item.id)} style={s.detailRow}>
              <View style={s.grow}>
                <Text style={[s.recentTitle, item.id === route.id && {color: GREEN}]}>{routeLabel(item, reversed)}</Text>
                <Text nativeID={`${informationId}-${index}`} style={s.subtitle}>{routeSummary(item)}</Text>
                {comparisonText !== '' && <Text style={s.subtitle}>{comparisonText}</Text>}
                {fareDifference && <Text style={s.subtitle}>{fareDifference}</Text>}
              </View>
            </Button>;
          })}
          {location && <Text style={s.subtitle}>GPS fix at {new Date(location.timestamp).toLocaleTimeString()}{location.accuracy === null ? '' : ` · ±${Math.round(location.accuracy)} m`}</Text>}
          </>}
          {route && isRoadRoute(route) && <Button reduced={reduced} label="Show transit demo routes" onPress={() => {setSelected(routes[0].id); setMapMode('demo'); setDetails(false);}} style={s.detailRow}><Text style={s.recentTitle}>Show transit demo routes</Text></Button>}
        </ScrollView>
        <Button reduced={reduced} label="Close route details" onPress={() => setDetails(false)} style={s.close}><Text style={s.closeText}>Done</Text></Button>
      </View></View>
    </Modal>
    <Modal visible={panel !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setPanel(null)}>
      <View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
        <Text accessibilityRole="header" style={s.heading}>{panel === 'menu' ? 'Menu' : 'Profile'}</Text>
        {panel === 'menu' ? <View style={s.menuItems}>
          <Button reduced={reduced} label="Search routes" style={s.menuItem} onPress={() => {setPanel(null); search();}}><Icon name="search" color={GREEN} /><Text style={s.recentTitle}>Search routes</Text></Button>
          <Button reduced={reduced} label="Use my location on map" style={s.menuItem} onPress={async () => {if (locating) return; setGpsRequested(true); setPanel(null); const fix = await locate(); if (fix) map.current?.centerOnLocation(fix); else setGpsNotice(true);}}><Icon name="target" color={GREEN} /><Text style={s.recentTitle}>{locating ? 'Getting GPS position…' : 'Locate & recenter on me'}</Text></Button>
          <Button reduced={reduced} label="Route details and alternatives" style={s.menuItem} onPress={() => {setPanel(null); setDetails(true);}}><Icon name="info" color={GREEN} /><Text style={s.recentTitle}>Route details & alternatives</Text></Button>
          <Button reduced={reduced} label="Open saved routes" style={s.menuItem} onPress={() => {setPanel(null); router.push('/saved');}}><Icon name="pin" color={GREEN} /><Text style={s.recentTitle}>Saved routes</Text></Button>
          <Button reduced={reduced} label="Open journey history" style={s.menuItem} onPress={() => {setPanel(null); router.push('/history');}}><Icon name="clock" color={GREEN} /><Text style={s.recentTitle}>Journey History</Text></Button>
          <Button reduced={reduced} label="Discard restart recovery" style={s.menuItem} onPress={() => {setPanel(null); setDiscard(true);}}><Icon name="info" color={GREEN} /><Text style={s.recentTitle}>Discard restart recovery</Text></Button>
        </View> : <Text style={s.notice}>You’re exploring as a guest. Profiles and sign-in aren’t available yet.</Text>}
        <Button reduced={reduced} label="Close panel" onPress={() => setPanel(null)} style={s.close}><Text style={s.closeText}>Close</Text></Button>
      </View></View>
    </Modal>
    <Modal visible={discard} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setDiscard(false)}><View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
      <Text accessibilityRole="header" style={s.heading}>Discard recovered journey?</Text><Text style={s.notice}>Clear search inputs, endpoint confirmations, active journey and search preferences. Saved routes and Journey History are kept.</Text>
      <Button reduced={reduced} label="Confirm discard recovery" onPress={() => {void discardRecovery().then(() => setDiscard(false)).catch(() => setDiscard(false));}} style={s.close}><Text style={s.closeText}>Discard</Text></Button>
      <Button reduced={reduced} label="Keep recovered journey" onPress={() => setDiscard(false)} style={s.detailRow}><Text style={s.recentTitle}>Keep journey</Text></Button>
    </View></View></Modal>
    <Modal visible={gpsNotice} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setGpsNotice(false)}><View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
      <Text accessibilityRole="header" style={s.heading}>Location unavailable</Text><Text style={s.notice}>{locationError}</Text>
      <Button reduced={reduced} label="Close location message" onPress={() => setGpsNotice(false)} style={s.close}><Text style={s.closeText}>Done</Text></Button>
    </View></View></Modal>
  </View>;
}
const s = StyleSheet.create({
  fill: {flex: 1, backgroundColor: '#000000'}, grow: {flex: 1, minWidth: 0},
  button: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8},
  top: {position: 'absolute', top: 0, left: 0, right: 0, padding: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  topIcon: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#242d27', borderWidth: 1, borderColor: '#3a473d'},
  search: {minWidth: 0, height: 60, borderRadius: 18, backgroundColor: '#242d27', borderWidth: 1, borderColor: '#3a473d'},
  detailRow: {minHeight: 64, marginVertical: 6},
  searchTitle: {fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#f0f5f0'}, subtitle: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17, color: '#a9b5ac'},
  menuItems: {gap: 8, marginVertical: 18}, menuItem: {height: 48, borderRadius: 12, backgroundColor: '#222c25'},
  floating: {position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sampleBadge: {flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, borderRadius: 10, backgroundColor: '#141c17ed'}, dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN},
  sampleText: {fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#c1cdc3', letterSpacing: 0.8},
  // The wrapper's 1dp border leaves a full 48dp Pressable inside.
  recenter: {height: 50, width: 50, borderRadius: 16, backgroundColor: '#202923', borderWidth: 1, borderColor: '#465249', elevation: 4},
  sheet: {position: 'absolute', bottom: 12, alignSelf: 'center', borderRadius: 26, backgroundColor: '#000000', borderWidth: 1, borderColor: '#354138', overflow: 'hidden', boxShadow: '0px 6px 24px rgba(0,0,0,0.25)', elevation: 8},
  handleContainer: {height: 28, alignItems: 'center', justifyContent: 'center'}, handle: {width: 24, height: 3, backgroundColor: '#536157', borderRadius: 4},
  sheetContent: {paddingHorizontal: 16, paddingBottom: 16},
  greeting: {fontFamily: 'Inter_600SemiBold', color: '#f0f5f0', fontSize: 22, lineHeight: 28, marginBottom: 12},
  heading: {fontFamily: 'Inter_600SemiBold', color: '#f0f5f0', fontSize: 17},
  recentTitle: {fontFamily: 'Inter_500Medium', color: '#e0e8df', fontSize: 12, lineHeight: 18},
  modalBackdrop: {flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000a'}, modal: {padding: 24, backgroundColor: '#1c261f', borderRadius: 24, maxWidth: 420, width: '100%', alignSelf: 'center'}, notice: {color: '#c1cdc3', fontSize: 14, lineHeight: 22, marginVertical: 18}, close: {minHeight: 48, minWidth: 48, backgroundColor: GREEN, borderRadius: 12}, closeText: {fontFamily: 'Inter_600SemiBold', color: '#14200f'},
});
