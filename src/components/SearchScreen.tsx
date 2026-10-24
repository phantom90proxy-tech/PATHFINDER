import {useTheme, useThemeStyles} from '../theme';
import React, {useContext, useEffect, useRef, useState} from 'react';
import {Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {usePrototype} from '../PrototypeState';
import {matchesDemo, rankedRoutes, type Preference} from '../data/routes';
import {searchPlaces, type Place} from '../services/placeSearch';
import {resolveEndpoint, type RoadRoute} from '../data/roadRoutes';
import {SearchSessionContext} from '../hooks/useSearchSession';
import {requestRoadRoutes} from '../services/roadRoutingClient';
import {RouteDiscovery, type DiscoveryPhase} from './RouteDiscovery';
import type {Endpoint} from '../services/endpointConfirmations';
import {isRequestCancelled} from '../services/requestCancellation';
import {transitAvailability} from '../data/transitAvailability';
import {fareLabel} from '../services/fareInformation';

const GREEN = '#9be570';
type Glyph = 'back' | 'arrow' | 'pin' | 'target' | 'swap' | 'wallet' | 'bolt' | 'people' | 'bus' | 'train' | 'car' | 'compare' | 'close' | 'info';
function Icon({name, color = '#a9b6ae', size = 22}: {name: Glyph; color?: string; size?: number}) {
  const {mode} = useTheme();
  const paths: Record<Glyph, string> = {
    back: 'M19 12H5m6-6-6 6 6 6', arrow: 'M5 12h14m-6-6 6 6-6 6',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z',
    target: 'M12 2v3m0 14v3M2 12h3m14 0h3', swap: 'M8 3v17m-4-4 4 4 4-4M16 21V4m-4 4 4-4 4 4',
    wallet: 'M4 6V5a2 2 0 0 1 2-2h12v3M20 10h-5v5h5M17 12.5h.1',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z',
    people: 'M3 21v-2a6 6 0 0 1 12 0v2M17 14a5 5 0 0 1 4 5v2M16 3a4 4 0 0 1 0 8',
    bus: 'M5 10h14M5 17v3m14-3v3M8 14h.1m8 0h.1M9 3h6',
    train: 'M5 10h14M8 14h.1m8 0h.1M8 18l-3 4m11-4 3 4M7 20h10M12 3v7',
    car: 'm4 10 2-6h12l2 6M4 10h16v8H4v-8ZM6 18v3m12-3v3M7 14h.1m10 0h.1',
    compare: 'M6 3v18M18 3v18M3 7h6m6 10h6M3 14h6m6-7h6', close: 'm6 6 12 12M6 18 18 6', info: 'M12 11v6m0-10v.1',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})}>
    {name === 'target' && <><Circle cx={12} cy={12} r={7} /><Circle cx={12} cy={12} r={2} /></>}
    {name === 'pin' && <Circle cx={12} cy={10} r={2} />}
    {name === 'people' && <Circle cx={9} cy={7} r={4} />}
    {name === 'info' && <Circle cx={12} cy={12} r={9} />}
    {name === 'wallet' && <Rect x={3} y={6} width={18} height={14} rx={3} />}
    {(name === 'bus' || name === 'train') && <Rect x={5} y={3} width={14} height={15} rx={4} />}
    <Path d={paths[name]} />
  </Svg>;
}
function Button({label, onPress, style, children, selected, disabled}: {label: string; onPress: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; selected?: boolean; disabled?: boolean}) {
  const s = useThemeStyles(baseStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{selected, disabled}} aria-pressed={selected} onPress={onPress}
    style={({pressed}) => [s.button, style, (pressed || disabled) && s.pressed]}>{children}</Pressable>;
}
const sampleDetail = (mode: string, fare: number, minutes: number) => `Demo mode: ${mode} · ${fareLabel({classification: 'demo', amount: fare, currency: 'PHP'})} · Demo travel time: ${minutes} min`;
const suggestions: {title: string; detail: string; icon: Glyph}[] = [
  {title: 'SM City Masinag - Cogeo Gate 2', detail: sampleDetail('Bus', 18, 14), icon: 'bus'},
  {title: 'Antipolo Station - Anonas Station', detail: sampleDetail('LRT-2', 13, 12), icon: 'train'},
  {title: 'Penafrancia - Padilla', detail: sampleDetail('Bus', 10, 7), icon: 'bus'},
  {title: 'Antipolo Station - Recto Station', detail: sampleDetail('LRT-2', 18, 17), icon: 'train'},
  {title: 'Marikina Valley Medical Center - Quezon…', detail: sampleDetail('Car', 220, 45), icon: 'car'},
  {title: 'Antipolo Station - Anonas Station', detail: sampleDetail('LRT-2', 13, 12), icon: 'train'},
];
const preferences: {label: Preference; icon: Glyph}[] = [{label: 'Cheapest', icon: 'wallet'}, {label: 'Fastest', icon: 'bolt'}, {label: 'Less Crowded', icon: 'people'}];

export function SearchScreen({onReturnHome}: {onReturnHome: () => void}) {
  const {color, mode} = useTheme();
  const s = useThemeStyles(baseStyles);
  const session = useContext(SearchSessionContext);
  if (!session) throw new Error('Search session provider missing');
  const {origin, setOrigin, destination, setDestination, confirmations, swapEndpoints, preference, setPreference, selected, selectedRoad, setSelected, cleared, setCleared, searchMode, setSearchMode, setRoadRoutes, setSelectedRoad, location, locate, locating, locationError} = usePrototype();
  const [focused, setFocused] = useState<'origin' | 'destination' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<DiscoveryPhase>(null);
  const [cardSize, setCardSize] = useState({width: 0, height: 0});
  const [routing, setRouting] = useState(false);
  const [roadChoices, setRoadChoices] = useState<RoadRoute[]>([]);
  const [cached, setCached] = useState(false);
  const busy = useRef<AbortSignal | null>(null);
  useEffect(() => () => session.cancelRequest(), [session, origin, destination, searchMode]);
  const [places, setPlaces] = useState<{endpoint: Endpoint; query: string; choices: Place[]; compare: boolean; isCurrent: () => boolean} | null>(null);
  const driving = searchMode === 'driving';
  const demoReversed = origin.trim().toLowerCase().replace(/\s+/g, ' ') === 'cogeo gate 2';
  const destinationInput = useRef<TextInput>(null);
  const unavailable = () => {setNotice(transitAvailability.unsupportedJourney); setPhase('error');};
  const validate = () => {if (matchesDemo(origin, destination)) return true; unavailable(); return false;};
  const selectRoute = (id: string, choices = roadChoices) => {
    if (!session.isActive()) return;
    if (driving) {setRoadRoutes(choices); setSelectedRoad(id);}
    else setSelected(id);
  };
  const leave = () => {session.exit(); Keyboard.dismiss(); setPhase(null); onReturnHome();};
  const selectExplicitly = (id: string) => {selectRoute(id);};
  const closeDiscovery = () => {session.cancelRequest(); setPhase(null); setNotice(null);};
  // Native Modal owns Android Back while visible; pending work uses the same exit guard.
  const discoveryBack = () => {if (phase === 'loading') leave(); else if (phase === 'compare') setPhase('results'); else closeDiscovery();};
  const routeRoad = async (compare: boolean) => {
    if ((busy.current && !busy.current.aborted) || locating || !session.isActive()) return;
    const signal = session.beginRequest();
    const sessionCurrent = session.capture();
    const endpointsCurrent = confirmations.capture();
    const isCurrent = () => sessionCurrent() && endpointsCurrent() && !signal.aborted;
    Keyboard.dismiss(); busy.current = signal; setRouting(true); setNotice(null); setPhase('loading');
    try {
      if (!origin.trim() || !destination.trim()) throw new Error('Enter both an origin and a destination.');
      const endpoints: Place[] = [];
      for (const [endpoint, query] of [['origin', origin], ['destination', destination]] as const) {
        let point;
        try {point = resolveEndpoint(query, location);} catch (error) {
          if (/^current location$/i.test(query.trim()) || /^[-+\d.\s]+,[-+\d.\s]+$/.test(query.trim())) throw error;
        }
        if (point) {endpoints.push({label: query.trim(), point}); continue;}
        const saved = confirmations.get(endpoint, query);
        if (saved) {endpoints.push(saved); continue;}
        const choices = await searchPlaces(query, signal);
        if (!isCurrent()) return;
        if (!choices.length) throw new Error('No locations found for ' + query + '. Add the city or enter latitude, longitude.');
        setPlaces({endpoint, query, choices, compare, isCurrent}); setPhase('places'); return;
      }
      if (!isCurrent()) return;
      for (const [index, endpoint] of (['origin', 'destination'] as const).entries()) {
        confirmations.confirm(endpoint, endpoint === 'origin' ? origin : destination, endpoints[index], isCurrent);
      }
      const result = await requestRoadRoutes({origin: endpoints[0].point, destination: endpoints[1].point, originLabel: endpoints[0].label, destinationLabel: endpoints[1].label}, signal);
      if (!isCurrent()) return;
      if (!result.routes.length) throw new Error('The routing server returned no usable routes. Try different endpoints.');
      setRoadChoices(result.routes); setCached(result.cached);
      const id = result.routes.some(route => route.id === selectedRoad) ? selectedRoad : result.routes[0].id;
      selectRoute(id, result.routes);
      setPhase(compare ? 'compare' : 'results');
    } catch (error) {if (isCurrent() && !isRequestCancelled(error)) {setNotice(error instanceof Error ? error.message : 'Routing is unavailable. Try again later.'); setPhase('error');}}
    finally {if (busy.current === signal) {busy.current = null; if (sessionCurrent()) setRouting(false);}}
  };
  const openDemo = (compare: boolean) => {
    if (!validate()) return;
    const coordinates = rankedRoutes(preference)[0].coordinates;
    confirmations.confirm('origin', origin, {label: origin.trim(), point: coordinates[demoReversed ? coordinates.length - 1 : 0]}, () => session.isActive());
    confirmations.confirm('destination', destination, {label: destination.trim(), point: coordinates[demoReversed ? 0 : coordinates.length - 1]}, () => session.isActive());
    Keyboard.dismiss(); selectRoute(compare && selected ? selected : rankedRoutes(preference)[0].id); setPhase(compare ? 'compare' : 'results');
  };
  const find = () => {if (locating || (busy.current && !busy.current.aborted)) return; if (driving) void routeRoad(false); else openDemo(false);};
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header} aria-hidden={phase !== null} accessibilityElementsHidden={phase !== null} importantForAccessibility={phase !== null ? 'no-hide-descendants' : 'auto'}>
      <Button label="Back to map" onPress={() => {session.exit(); Keyboard.dismiss(); onReturnHome();}} style={s.iconButton}><Icon name="back" color="#eef4ed" /></Button>
      <View style={s.grow}><Text style={s.eyebrow}>YOUR NEXT JOURNEY</Text><Text accessibilityRole="header" style={s.title}>Plan your ride</Text></View>
    </View>
    <ScrollView aria-hidden={phase !== null} accessibilityElementsHidden={phase !== null} importantForAccessibility={phase !== null ? 'no-hide-descendants' : 'auto'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={[s.preferences, {marginBottom: 16}]}>
        <Button label="Road driving routes" disabled={routing || locating} selected={driving} onPress={() => setSearchMode('driving')} style={[s.preference, driving && s.preferenceSelected]}><Icon name="car" color={GREEN} /><Text style={s.preferenceText}>Road Finder</Text></Button>
        <Button label="Public transport demo" disabled={routing || locating} selected={!driving} onPress={() => setSearchMode('demo')} style={[s.preference, !driving && s.preferenceSelected]}><Icon name="bus" color={GREEN} /><Text style={s.preferenceText}>Transit demo</Text></Button>
      </View>
      <View style={s.locationCard} onLayout={({nativeEvent: {layout}}) => setCardSize(current => current.width === layout.width && current.height === layout.height ? current : {width: layout.width, height: layout.height})}>
        {cardSize.width > 0 && <Svg pointerEvents="none" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} style={StyleSheet.absoluteFill} width={cardSize.width} height={cardSize.height}>
          <Path fill={color('#19221c')} stroke={color('#334039')} strokeWidth={1} d={`M25 1 H${cardSize.width - 88} Q${cardSize.width - 72} 1 ${cardSize.width - 72} 17 V43 Q${cardSize.width - 72} 59 ${cardSize.width - 56} 59 H${cardSize.width - 25} Q${cardSize.width - 1} 59 ${cardSize.width - 1} 83 V${cardSize.height - 25} Q${cardSize.width - 1} ${cardSize.height - 1} ${cardSize.width - 25} ${cardSize.height - 1} H25 Q1 ${cardSize.height - 1} 1 ${cardSize.height - 25} V25 Q1 1 25 1 Z`} />
        </Svg>}
        <Button label="Swap origin and destination" disabled={routing || locating} style={s.swap} onPress={swapEndpoints}><Icon name="swap" size={21} color={GREEN} /></Button>
        <View style={[s.field, s.originField, focused === 'origin' && s.fieldFocused]}>
          <Icon name="target" color={GREEN} /><View style={s.grow}><Text style={s.fieldLabel}>FROM</Text><TextInput editable={!routing && !locating} accessibilityLabel="Origin" value={origin} onChangeText={setOrigin}
            placeholder="Where are you starting?" placeholderTextColor="#78887e" style={s.input} selectionColor={mode === 'light' ? '#386b27' : GREEN} autoCorrect={false}
            onFocus={() => setFocused('origin')} onBlur={() => setFocused(null)} returnKeyType="next" onSubmitEditing={() => destinationInput.current?.focus()} /></View>
        </View>
        <View style={s.divider} />
        <View style={[s.field, focused === 'destination' && s.fieldFocused]}>
          <Icon name="pin" color={GREEN} /><View style={s.grow}><Text style={s.fieldLabel}>TO</Text><TextInput ref={destinationInput} editable={!routing} accessibilityLabel="Destination" value={destination} onChangeText={setDestination}
            placeholder="Where do you want to go?" placeholderTextColor="#a9b6ae" style={s.input} selectionColor={mode === 'light' ? '#386b27' : GREEN} autoCorrect={false}
            onFocus={() => setFocused('destination')} onBlur={() => setFocused(null)} returnKeyType="search" onSubmitEditing={find} /></View>
        </View>
      </View>
      {driving && <View style={{gap: 8, marginTop: 12}}>
        <Button label="Use my location as origin" disabled={routing || locating} style={s.secondary} onPress={async () => {const isCurrent = session.capture(); const fix = await locate(); if (fix && isCurrent()) setOrigin('Current location');}}><Icon name="target" color={GREEN} /><Text style={s.secondaryText}>{locating ? 'Getting GPS position…' : 'Use my location'}</Text></Button>
        <Text style={s.meta}>Enter a place with its city, latitude, longitude, or use GPS. On search, place names go to Photon and confirmed coordinates go to OSRM. Location search: Photon · © OpenStreetMap contributors.</Text>
        {location && <Text style={s.meta}>GPS fix: {new Date(location.timestamp).toLocaleTimeString()}{location.accuracy === null ? '' : ' · ±' + Math.round(location.accuracy) + ' m'}</Text>}
        {locationError && <Text accessibilityRole="alert" style={s.modalCopy}>{locationError}</Text>}
      </View>}
      {!driving && <View style={s.preferenceSection}>
        <Text style={s.meta}>Demo only · Routes, fares, times and crowd levels are samples. No verified stops, schedules or live transit data.</Text>
        <Text style={s.sectionLabel}>What matters most?</Text>
        <View style={s.preferences}>{preferences.map(item => <Button key={item.label} label={item.label === 'Cheapest' ? 'Sort by lowest demo fare' : item.label === 'Less Crowded' ? 'Sort by demo crowding' : `Sort by ${item.label}`} selected={preference === item.label}
          onPress={() => setPreference(item.label)} style={[s.preference, preference === item.label && s.preferenceSelected]}>
          <Icon name={item.icon} size={18} color={preference === item.label ? GREEN : '#a9b6ae'} /><Text style={[s.preferenceText, preference === item.label && s.greenText]}>{item.label === 'Cheapest' ? 'Demo fare' : item.label === 'Less Crowded' ? 'Demo crowding' : item.label}</Text>
        </Button>)}</View>
      </View>}
      <View style={s.actions}>
        <Button label="Find Routes" disabled={routing || locating} onPress={find} style={s.primary}><Text style={s.primaryText}>{routing ? 'Requesting road routes…' : driving ? 'Find driving routes' : 'Find demo routes'}</Text><Icon name="arrow" color="#172510" size={20} /></Button>
        <Button label="Compare Routes" disabled={routing || locating} onPress={() => {if (driving) {void routeRoad(true); return;} openDemo(true);}} style={s.secondary}><Icon name="compare" size={19} /><Text style={s.secondaryText}>Compare routes</Text></Button>
      </View>
      {driving ? <View style={{marginTop: 20, gap: 8}}><Text style={s.sectionTitle}>Known destinations</Text>{['SM City Masinag', 'Cogeo Gate 2'].map(place => <Button key={place} disabled={routing} label={'Set destination ' + place} style={s.secondary} onPress={() => setDestination(place)}><Icon name="pin" color={GREEN} /><Text style={s.secondaryText}>{place}</Text></Button>)}</View> : <>
      <View style={s.sectionHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Suggested demo routes</Text><Button label={cleared ? 'Restore suggestions' : 'Clear All'} onPress={() => setCleared(!cleared)} style={s.textButton}><Text style={s.link}>{cleared ? 'Restore' : 'Clear all'}</Text></Button></View>
      <View style={s.suggestions}>
        {cleared ? <View style={s.empty}><Icon name="pin" size={28} /><Text style={s.sectionTitle}>A fresh start</Text><Text style={s.meta}>Enter a destination or restore your suggestions.</Text></View> : suggestions.map((item, index) => <Button key={`${item.title}-${index}`} label={`Choose ${item.title}`} style={[s.suggestion, index > 0 && s.rowBorder]} onPress={() => {if (index === 0) {setOrigin('SM City Masinag'); setDestination('Cogeo Gate 2');} else unavailable();}}>
          <View style={[s.transport, index === 0 && s.transportFeatured]}><Icon name={item.icon} color={index === 0 ? GREEN : '#a9b6ae'} size={21} /></View>
          <View style={s.grow}><Text style={s.routeTitle} numberOfLines={2}>{item.title}</Text><Text style={s.meta}>{item.detail}</Text></View><Icon name="arrow" size={17} color="#7d8e81" />
        </Button>)}
      </View>
      </>}
      <View style={s.footnote}><Icon name="info" size={15} /><Text style={s.footnoteText}>{driving ? 'OSRM public demo · Driving estimates only · No live traffic, fares or crowd data' : 'Sample routes, fares, times and crowds · Not live'}</Text></View>
    </ScrollView>
    <RouteDiscovery phase={phase} origin={driving && (phase === 'results' || phase === 'compare') ? roadChoices[0]?.origin ?? origin : origin} destination={driving && (phase === 'results' || phase === 'compare') ? roadChoices[0]?.destination ?? destination : destination}
      places={places ? {...places, onChoose: place => {if (!confirmations.confirm(places.endpoint, places.query, place, places.isCurrent)) return; setPlaces(null); void routeRoad(places.compare);}} : undefined} driving={driving}
      routes={driving ? roadChoices : rankedRoutes(preference)} selected={driving ? selectedRoad : selected}
      reversed={!driving && demoReversed} cached={cached} notice={notice} preference={preference}
      onBack={discoveryBack} onClose={closeDiscovery} onRetry={() => void routeRoad(false)}
      onSelect={selectExplicitly} />
  </KeyboardAvoidingView>;
}
const baseStyles = StyleSheet.create({
  fill: {flex: 1, backgroundColor: '#000000'}, grow: {flex: 1, minWidth: 0},
  button: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48}, pressed: {opacity: 0.7},
  header: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, width: '100%', maxWidth: 600, alignSelf: 'center'},
  iconButton: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#1c2620'},
  eyebrow: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.6, color: '#91a096', marginBottom: 5}, title: {fontFamily: 'Inter_600SemiBold', fontSize: 25, letterSpacing: -0.8, color: '#f2f6f0'},
  content: {paddingHorizontal: 20, paddingBottom: 24, width: '100%', maxWidth: 600, alignSelf: 'center'},
  locationCard: {padding: 10}, originField: {marginRight: 64},
  field: {flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'transparent', borderRadius: 14, minHeight: 74},
  fieldFocused: {borderColor: '#9be570', backgroundColor: '#222e24'}, fieldLabel: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: '#94a398', marginBottom: 5},
  input: {fontFamily: 'Inter_500Medium', fontSize: 16, color: '#f1f6ee', padding: 0, minHeight: 26},
  divider: {height: 1, backgroundColor: '#334039', marginHorizontal: 14, marginVertical: 12},
  swap: {position: 'absolute', top: 0, right: 0, width: 56, height: 48, borderRadius: 16, backgroundColor: '#29372c', borderWidth: 1, borderColor: '#425343', zIndex: 1},
  preferenceSection: {marginTop: 24}, sectionLabel: {fontFamily: 'Inter_500Medium', fontSize: 12, color: '#a9b6ae', marginBottom: 12}, preferences: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  preference: {flexGrow: 1, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#303d34', borderRadius: 14, backgroundColor: '#19221c'},
  preferenceSelected: {borderColor: '#6f9e53', backgroundColor: '#253722'}, preferenceText: {fontFamily: 'Inter_500Medium', fontSize: 11, color: '#b6c1b9'}, greenText: {color: GREEN},
  actions: {gap: 8, marginTop: 22}, primary: {minHeight: 54, borderRadius: 16, backgroundColor: GREEN}, primaryText: {fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#172510'},
  secondary: {minHeight: 48, borderRadius: 16, backgroundColor: '#19221c', borderWidth: 1, borderColor: '#303d34'}, secondaryText: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#c3cec5'},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12}, sectionTitle: {fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#edf3ea', flexShrink: 1}, textButton: {paddingHorizontal: 6}, link: {fontFamily: 'Inter_500Medium', color: '#a9c998', fontSize: 12},
  suggestions: {backgroundColor: '#17201a', borderRadius: 20, borderWidth: 1, borderColor: '#2b372f', overflow: 'hidden'},
  suggestion: {paddingHorizontal: 14, paddingVertical: 16, gap: 12, justifyContent: 'flex-start', minHeight: 82}, rowBorder: {borderTopWidth: 1, borderTopColor: '#29352d'},
  transport: {width: 42, height: 42, borderRadius: 14, backgroundColor: '#253027', justifyContent: 'center', alignItems: 'center'}, transportFeatured: {backgroundColor: '#2a3d24'},
  routeTitle: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#e5ede2'}, meta: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d', marginTop: 4},
  empty: {padding: 24, alignItems: 'center', gap: 10}, footnote: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 20}, footnoteText: {flexShrink: 1, fontFamily: 'Inter_500Medium', fontSize: 9, lineHeight: 15, color: '#99a89d'},
  backdrop: {flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 20}, modal: {width: '100%', maxWidth: 480, alignSelf: 'center', padding: 20, backgroundColor: '#19221c', borderRadius: 24, borderWidth: 1, borderColor: '#334039'},
  modalCopy: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#b6c1b9', marginVertical: 16}, compareRow: {paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#334039'}, recommended: {fontFamily: 'Inter_500Medium', fontSize: 10, color: GREEN, marginTop: 6},
});
