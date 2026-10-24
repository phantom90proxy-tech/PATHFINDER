import {useTheme, useThemeStyles} from '../theme';
import {rankRoadRoutes, roadRouteComparison} from '../services/roadRouteRanking';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {router, Stack} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurTargetView, BlurView} from 'expo-blur';
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
// Keep development controls out of the production render tree and module path.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro can eliminate this development-only dependency in production.
const DevOnboardingReset: typeof import('./DevOnboardingReset').DevOnboardingReset | null = __DEV__ ? require('./DevOnboardingReset').DevOnboardingReset : null;

const GREEN = '#7ed957';
type Glyph = 'search' | 'arrow' | 'target' | 'info' | 'pin' | 'clock' | 'chevron' | 'menu' | 'profile';
function Icon({name, color = '#edf2ed', size = 22}: {name: Glyph; color?: string; size?: number}) {
  const {mode} = useTheme();
  const paths: Record<Glyph, string> = {
    search: 'm16 16 5 5', arrow: 'M5 12h14m-6-6 6 6-6 6',
    target: 'M12 2v3m0 14v3M2 12h3m14 0h3', info: 'M12 11v6m0-10v.1',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z',
    clock: 'M12 7v5l3 2', chevron: 'm8 10 4 4 4-4',
    menu: 'M4 6h16M4 12h16M4 18h16', profile: 'M4 21v-2a8 8 0 0 1 16 0v2',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {name === 'search' && <Circle cx={10.5} cy={10.5} r={6.5} />}
    {['target', 'info', 'clock'].includes(name) && <Circle cx={12} cy={12} r={name === 'target' ? 7 : 9} />}
    {name === 'target' && <Circle cx={12} cy={12} r={2} />}
    {name === 'pin' && <Circle cx={12} cy={10} r={2} />}
    {name === 'profile' && <Circle cx={12} cy={7} r={4} />}
    <Path d={paths[name]} />
  </Svg>;
}
function Button({label, onPress, children, style, reduced, selected, expanded, hint, describedBy, alignStart}: {
  label: string; onPress: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>;
  reduced: boolean; selected?: boolean; expanded?: boolean; hint?: string; describedBy?: string; alignStart?: boolean;
}) {
  const s = useThemeStyles(baseStyles);
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (value: number) => {
    scale.stopAnimation();
    Animated.timing(scale, {toValue: value, duration: reduced ? 0 : 120, useNativeDriver: Platform.OS !== 'web'}).start();
  };
  return <Animated.View style={[style, {transform: [{scale}]}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} {...(Platform.OS === 'web' ? {'aria-describedby': describedBy} : {})} accessibilityState={{selected, expanded}} aria-pressed={selected} aria-expanded={expanded}
      onPress={onPress} onPressIn={() => animate(0.97)} onPressOut={() => animate(1)}
      style={({pressed}) => [s.button, alignStart && s.menuRow, {opacity: pressed ? 0.76 : 1}]}>{children}</Pressable>
  </Animated.View>;
}

function MenuEntry({icon, title, subtitle, label, onPress, reduced, featured = false}: {icon: Glyph; title: string; subtitle: string; label: string; onPress: () => void; reduced: boolean; featured?: boolean}) {
  const s = useThemeStyles(baseStyles);
  return <Button reduced={reduced} label={label} onPress={onPress} style={s.menuItem} alignStart>
    <View style={[s.menuIcon, featured && s.menuIconFeatured]}><Icon name={icon} color={featured ? '#172510' : '#9be570'} size={20} /></View>
    <View style={s.grow}><Text style={s.menuTitle}>{title}</Text><Text style={s.menuSubtitle}>{subtitle}</Text></View>
    <View style={{transform: [{rotate: '-90deg'}]}}><Icon name="chevron" color="#738578" size={16} /></View>
  </Button>;
}

export function HomeScreen({width, height}: {width: number; height: number}) {
  const blurTarget = useRef<View | null>(null);
  const {mode, setMode, error: appearanceError} = useTheme();
  const s = useThemeStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(width * 0.8, 320);
  const [drawerProgress] = useState(() => new Animated.Value(0));
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
  useEffect(() => {
    drawerProgress.setValue(0);
    if (panel === 'menu') {
      Animated.timing(drawerProgress, {toValue: 1, duration: reduced ? 0 : 240, useNativeDriver: Platform.OS !== 'web'}).start();
    }
    return () => drawerProgress.stopAnimation();
  }, [panel, reduced, drawerProgress]);
  const [details, setDetails] = useState(false);
  const [gpsNotice, setGpsNotice] = useState(false);
  const [gpsRequested, setGpsRequested] = useState(false);
  const recoveryNotice = recoveryError ?? recoveredJourney;
  const [recoveryProgress] = useState(() => new Animated.Value(0));
  const [locationProgress] = useState(() => new Animated.Value(0));
  const [dismissedRecoveryNotice, setDismissedRecoveryNotice] = useState<typeof recoveryNotice>(null);
  useEffect(() => {
    if (!recoveryNotice) return;
    recoveryProgress.setValue(0);
    Animated.timing(recoveryProgress, {toValue: 1, duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start();
    const timer = setTimeout(() => {
      Animated.timing(recoveryProgress, {toValue: 0, duration: reduced ? 0 : 220, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start(({finished}) => {if (finished) setDismissedRecoveryNotice(recoveryNotice);});
    }, 5000);
    return () => {clearTimeout(timer); recoveryProgress.stopAnimation();};
  }, [recoveryNotice, recoveryProgress, reduced]);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (!gpsRequested) {locationProgress.setValue(0); return;}
    Animated.timing(locationProgress, {toValue: 1, duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start();
    const timer = locating ? undefined : setTimeout(() => {
      Animated.timing(locationProgress, {toValue: 0, duration: reduced ? 0 : 220, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start(({finished}) => {if (finished) setGpsRequested(false);});
    }, 5000);
    return () => {clearTimeout(timer); locationProgress.stopAnimation();};
  }, [gpsRequested, locating, locationProgress, reduced]);
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
    <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
      <RouteMap ref={map} width={width} height={height} route={null} routes={[]} location={location} reversed={false} onSelect={() => {}} overlays={overlays} reducedMotion={reduced} />
    </BlurTargetView>
    <View pointerEvents="box-none" style={s.top}>
      <Button reduced={reduced} label="Open menu" onPress={() => setPanel('menu')} style={s.topIcon}><Icon name="menu" /></Button>
      <Button reduced={reduced} label="Open profile" onPress={() => setPanel('profile')} style={s.topIcon}><Icon name="profile" color={GREEN} /></Button>
    </View>
    {recoveryNotice && dismissedRecoveryNotice !== recoveryNotice && <Animated.View testID="recovery-notification" style={[s.notification, {borderColor: mode === 'dark' ? '#d8ebcc33' : '#ffffff88', opacity: recoveryProgress, transform: [{translateY: recoveryProgress.interpolate({inputRange: [0, 1], outputRange: [reduced ? 0 : -12, 0]})}]}]}>
      <BlurView pointerEvents="none" blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" tint={mode} intensity={45} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: mode === 'dark' ? '#152019b8' : '#e3e9debd'}]} />
      <Text accessibilityLiveRegion="polite" style={s.subtitle}>{recoveryError ?? 'Restored journey — previously retrieved information. Estimates may be outdated; no live traffic, fares or crowding. Discard from Menu.'}</Text>
    </Animated.View>}
    {gpsRequested && <Animated.View pointerEvents="none" style={{position: 'absolute', top: 68, left: 16, right: 16, alignItems: 'center', opacity: locationProgress, transform: [{translateY: locationProgress.interpolate({inputRange: [0, 1], outputRange: [reduced ? 0 : -12, 0]})}]}}>
      <View style={[s.locationNotification, {borderColor: mode === 'dark' ? '#d8ebcc33' : '#ffffff88'}]}>
      <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" tint={mode} intensity={45} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, {backgroundColor: mode === 'dark' ? '#152019b8' : '#e3e9debd'}]} />
      <Text role="status" accessibilityLiveRegion="polite" style={s.subtitle}>
        {locating ? 'Getting your location…' : locationError ? 'Location unavailable. Open Menu to retry.' : location ? 'Location updated' : ''}
      </Text>
      </View>
    </Animated.View>}
    <Animated.View pointerEvents="box-none" style={[s.floating, {bottom: sheetHeight + 40}]}>
      <Button reduced={reduced} label="Center map on my location" onPress={() => {if (location) map.current?.centerOnLocation(location); else {setGpsRequested(true); void locate().then(fix => {if (fix) map.current?.centerOnLocation(fix);});}}} style={s.recenter}><Icon name="target" /></Button>
    </Animated.View>
    <Animated.View testID="home-sheet" style={[s.sheet, {height: sheetHeight, width: Math.min(width - 20, 600), left: (width - Math.min(width - 20, 600)) / 2}]}>
      <View style={s.handleContainer}><View style={s.handle} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
        <Text accessibilityRole="header" style={s.greeting}>Hello, PATHFINDER</Text>
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
      <View style={panel === 'menu' ? s.drawerBackdrop : s.modalBackdrop}>
        {panel === 'menu' && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss menu" onPress={() => setPanel(null)} style={StyleSheet.absoluteFill} />}
        <Animated.View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={panel === 'menu' ? 'Menu' : 'Profile'} testID={panel === 'menu' ? 'side-menu' : 'profile-panel'} style={panel === 'menu' ? [s.drawer, {width: drawerWidth, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, transform: [{translateX: drawerProgress.interpolate({inputRange: [0, 1], outputRange: [-drawerWidth, 0]})}]}] : s.modal}>
        {panel === 'menu' ? <View style={s.drawerHeader}><View style={s.drawerLogo}><Icon name="pin" color="#172510" size={26} /></View><View><Text accessibilityRole="header" style={s.drawerBrand}>PATHFINDER</Text><Text style={s.drawerSubtitle}>Find your way. Ride better.</Text></View></View> : null}
        {panel === 'menu' ? <ScrollView style={s.drawerScroll} contentContainerStyle={s.menuItems} showsVerticalScrollIndicator={false}>
          <Text style={s.menuSection}>EXPLORE</Text>
          <MenuEntry reduced={reduced} icon="search" title="Search routes" subtitle="Plan your next ride" label="Search routes" featured onPress={() => {setPanel(null); search();}} />
          <MenuEntry reduced={reduced} icon="target" title={locating ? 'Locating you…' : 'My location'} subtitle="Find yourself on the map" label="Use my location on map" onPress={async () => {if (locating) return; setGpsRequested(true); setPanel(null); const fix = await locate(); if (fix) map.current?.centerOnLocation(fix); else setGpsNotice(true);}} />
          <MenuEntry reduced={reduced} icon="info" title="Route details" subtitle="View your route and alternatives" label="Route details and alternatives" onPress={() => {setPanel(null); setDetails(true);}} />
          <Text style={s.menuSection}>YOUR JOURNEYS</Text>
          <MenuEntry reduced={reduced} icon="pin" title="Saved routes" subtitle="Your go-to journeys" label="Open saved routes" onPress={() => {setPanel(null); router.push('/saved');}} />
          <MenuEntry reduced={reduced} icon="clock" title="Journey history" subtitle="Revisit your recent trips" label="Open journey history" onPress={() => {setPanel(null); router.push('/history');}} />
          <Text style={s.menuSection}>HELP & INFORMATION</Text>
          <MenuEntry reduced={reduced} icon="profile" title="Contact & Support" subtitle="Get help with PATHFINDER" label="Contact & Support" onPress={() => {setPanel(null); router.push({pathname: '/information', params: {section: 'support'}});}} />
          <MenuEntry reduced={reduced} icon="info" title="FAQ" subtitle="Answers to common questions" label="FAQ" onPress={() => {setPanel(null); router.push({pathname: '/information', params: {section: 'faq'}});}} />
          <MenuEntry reduced={reduced} icon="profile" title="Developers" subtitle="The people behind the app" label="Developers" onPress={() => {setPanel(null); router.push({pathname: '/information', params: {section: 'developers'}});}} />
          <MenuEntry reduced={reduced} icon="pin" title="About PATHFINDER" subtitle="Our purpose and how it works" label="About PATHFINDER" onPress={() => {setPanel(null); router.push({pathname: '/information', params: {section: 'about'}});}} />
          <View style={s.menuDivider} />
          <MenuEntry reduced={reduced} icon="info" title="Reset journey" subtitle="Clear your restored trip" label="Discard restart recovery" onPress={() => {setPanel(null); setDiscard(true);}} />
        </ScrollView> : <ScrollView style={{maxHeight: height * 0.65}} contentContainerStyle={s.profileContent} showsVerticalScrollIndicator={false}>
          <View style={s.profileIdentity}>
            <View style={s.profileHeroTop}><View style={s.profileAvatar}><Icon name="profile" color="#172510" size={30} /></View><View style={s.profileBadge}><Text style={s.profileBadgeText}>DEMO PROFILE</Text></View></View>
            <Text style={s.profileName}>PATHFINDER</Text>
            <Text style={s.profileTagline}>A better way to get there.</Text>
            <View style={s.profileCity}><Icon name="pin" color="#9be570" size={14} /><Text style={s.profileCityText}>Antipolo City, Philippines</Text></View>
          </View>
          <Text style={s.profileSection}>APPEARANCE</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={s.appearanceOptions}>
            {(['light', 'dark'] as const).map(option => <Pressable key={option} accessibilityRole="radio" accessibilityLabel={option === 'light' ? 'Light mode' : 'Dark mode'} accessibilityState={{checked: mode === option}} aria-checked={mode === option} onPress={() => setMode(option)} style={[s.appearanceOption, mode === option && s.appearanceSelected]}><Text style={s.profileFieldValue}>{option === 'light' ? '☀  Light' : '☾  Dark'}</Text><Text style={s.profileFieldLabel}>{mode === option ? 'Selected' : 'Tap to switch'}</Text></Pressable>)}
          </View>
          {appearanceError && <Text accessibilityRole="alert" style={s.profileCaption}>{appearanceError}</Text>}
          <Text style={s.profileSection}>PERSONAL DETAILS</Text>
          <View style={s.profileFields}>
            {[
              ['Display name', 'PATHFINDER'],
              ['Email', 'traveler@example.com'],
            ].map(([label, value], index) => <View key={label} style={[s.profileField, index > 0 && s.profileFieldBorder]}><Text style={s.profileFieldLabel}>{label}</Text><Text style={s.profileFieldValue}>{value}</Text></View>)}
          </View>
          <Text style={s.profileSection}>TRAVEL PREFERENCES</Text>
          <View style={s.profilePreferences}>
            <View style={s.profilePreference}><View style={s.profilePreferenceIcon}><Icon name="arrow" color="#9be570" size={20} /></View><Text style={s.profileFieldLabel}>Transport</Text><Text style={s.profileFieldValue}>Bus + Jeep</Text></View>
            <View style={s.profilePreference}><View style={s.profilePreferenceIcon}><Icon name="pin" color="#9be570" size={20} /></View><Text style={s.profileFieldLabel}>Priority</Text><Text style={s.profileFieldValue}>Lowest fare</Text></View>
          </View>
          <View style={s.profileDisclaimer}><Icon name="info" color="#91a096" size={16} /><Text style={s.profileCaption}>Sample information for display only.</Text></View>
          {__DEV__ && DevOnboardingReset && <DevOnboardingReset />}
        </ScrollView>}
        {panel !== 'menu' && <Button reduced={reduced} label="Close panel" onPress={() => setPanel(null)} style={s.close}><Text style={s.closeText}>Close</Text></Button>}
      </Animated.View></View>
    </Modal>
    <Modal visible={discard} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setDiscard(false)}><View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
      <Text accessibilityRole="header" style={s.heading}>Discard recovered journey?</Text><Text style={s.notice}>Clear search inputs, endpoint confirmations, active journey and search preferences. Saved routes and Journey History are kept.</Text>
      <Button reduced={reduced} label="Confirm discard recovery" onPress={() => {void discardRecovery().then(() => setDiscard(false)).catch(() => setDiscard(false));}} style={[s.close, mode === 'light' && {backgroundColor: '#386b27'}]}><Text style={[s.closeText, mode === 'light' && {color: '#edf3ea'}]}>Discard</Text></Button>
      <Button reduced={reduced} label="Keep recovered journey" onPress={() => setDiscard(false)} style={s.keepJourney}><Text style={[s.recentTitle, mode === 'light' && {color: '#386b27'}]}>Keep journey</Text></Button>
    </View></View></Modal>
    <Modal visible={gpsNotice} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setGpsNotice(false)}><View style={s.modalBackdrop}><View accessibilityViewIsModal style={s.modal}>
      <Text accessibilityRole="header" style={s.heading}>Location unavailable</Text><Text style={s.notice}>{locationError}</Text>
      <Button reduced={reduced} label="Close location message" onPress={() => setGpsNotice(false)} style={s.close}><Text style={s.closeText}>Done</Text></Button>
    </View></View></Modal>
  </View>;
}
const baseStyles = StyleSheet.create({
  keepJourney: {minHeight: 48, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#425343', backgroundColor: '#19221c'},
  notification: {position: 'absolute', top: 72, left: 16, right: 16, padding: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1},
  locationNotification: {borderRadius: 14, padding: 12, borderWidth: 1, overflow: 'hidden'},
  appearanceOptions: {flexDirection: 'row', gap: 10},
  appearanceOption: {flex: 1, minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: '#334039', backgroundColor: '#141e18', padding: 14, gap: 6},
  appearanceSelected: {borderColor: '#7ed957', backgroundColor: '#253722'},
  fill: {flex: 1, backgroundColor: '#000000'}, grow: {flex: 1, minWidth: 0},
  button: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8},
  top: {position: 'absolute', top: 0, left: 0, right: 0, padding: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  topIcon: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#242d27', borderWidth: 1, borderColor: '#3a473d'},
  search: {minWidth: 0, height: 60, borderRadius: 18, backgroundColor: '#242d27', borderWidth: 1, borderColor: '#3a473d'},
  detailRow: {minHeight: 64, marginVertical: 6},
  searchTitle: {fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#f0f5f0'}, subtitle: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17, color: '#a9b5ac'},
  menuItems: {gap: 6, paddingVertical: 12}, menuItem: {minHeight: 70, borderRadius: 16, backgroundColor: '#1b2720', overflow: 'hidden'},
  menuRow: {justifyContent: 'flex-start', gap: 12, paddingHorizontal: 12, paddingVertical: 12},
  menuIcon: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26372b'},
  menuIconFeatured: {backgroundColor: '#9be570'},
  menuTitle: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, color: '#edf3ea'},
  menuSubtitle: {fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 16, color: '#91a096', marginTop: 2},
  menuSection: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: '#91a096', marginTop: 16, marginBottom: 6, marginLeft: 4},
  menuDivider: {height: 1, backgroundColor: '#2c3b31', marginVertical: 14, marginHorizontal: 4},
  drawerBackdrop: {flex: 1, backgroundColor: '#000a', alignItems: 'flex-start'},
  drawer: {height: '100%', paddingHorizontal: 16, backgroundColor: '#111b15', borderRightWidth: 1, borderColor: '#334039', borderTopRightRadius: 24, borderBottomRightRadius: 24},
  drawerHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 24, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#334039'},
  drawerLogo: {width: 46, height: 46, backgroundColor: '#9be570', borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  drawerBrand: {fontFamily: 'Inter_600SemiBold', fontSize: 16, letterSpacing: 1.2, color: '#edf3ea'},
  drawerSubtitle: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d', marginTop: 3},
  drawerScroll: {flex: 1, marginTop: 8},
  profileContent: {gap: 12, paddingTop: 18, paddingBottom: 20},
  profileIdentity: {gap: 8, padding: 18, borderRadius: 22, backgroundColor: '#243829', borderWidth: 1, borderColor: '#3e5941', overflow: 'hidden'},
  profileHeroTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8},
  profileAvatar: {height: 54, width: 54, borderRadius: 18, backgroundColor: '#9be570', alignItems: 'center', justifyContent: 'center'},
  profileName: {fontFamily: 'Inter_600SemiBold', fontSize: 23, letterSpacing: -0.7, color: '#edf3ea'},
  profileTagline: {fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color: '#bccabf'},
  profileCity: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6},
  profileCityText: {fontFamily: 'Inter_500Medium', fontSize: 10, color: '#b5c8b6', flexShrink: 1},
  profileSection: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.4, color: '#91a096', marginTop: 8, marginLeft: 2},
  profilePreferences: {flexDirection: 'row', gap: 10},
  profilePreference: {flex: 1, padding: 14, borderRadius: 16, backgroundColor: '#141e18', borderWidth: 1, borderColor: '#334039', gap: 5},
  profilePreferenceIcon: {marginBottom: 7},
  profileDisclaimer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4},
  profileCaption: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d', textAlign: 'center'},
  profileBadge: {backgroundColor: '#15251a', paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1, borderColor: '#466144'},
  profileBadgeText: {fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 1, color: '#a5e582'},
  profileFields: {paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#141e18', borderWidth: 1, borderColor: '#334039'},
  profileField: {paddingVertical: 11, gap: 4},
  profileFieldBorder: {borderTopWidth: 1, borderColor: '#2c3b31'},
  profileFieldLabel: {fontFamily: 'Inter_500Medium', fontSize: 10, color: '#91a096'},
  profileFieldValue: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, color: '#edf3ea'},
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
