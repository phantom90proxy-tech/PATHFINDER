import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Platform, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useFonts, Inter_500Medium, Inter_600SemiBold} from '@expo-google-fonts/inter';
import {usePathname} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import Svg, {Circle, Path} from 'react-native-svg';
import {usePrototype} from '../PrototypeState';
import {SplashRoute} from './SplashRoute';

const ReadyContext = createContext<() => void>(() => {});
export function useStartupReady(ready: boolean) {
  const signalReady = useContext(ReadyContext);
  useEffect(() => {if (ready) signalReady();}, [ready, signalReady]);
}

// This overlay belongs to the root layout, never a route or an AppState listener.
export function StartupSplash({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const {recoveryReady} = usePrototype();
  const [fontsLoaded, fontError] = useFonts({Inter_500Medium, Inter_600SemiBold});
  const [screenReady, setScreenReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [resourceTimeout, setResourceTimeout] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [compositionReady, setCompositionReady] = useState(false);
  const {width, height} = useWindowDimensions();
  const [logo] = useState(() => new Animated.Value(1));
  const [pin] = useState(() => new Animated.Value(0));
  const [route] = useState(() => new Animated.Value(0));
  const [name] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const sequence = useRef<Animated.CompositeAnimation | null>(null);
  const ready = !!(fontsLoaded || fontError) && recoveryReady && (screenReady || pathname !== '/');
  const signalReady = useCallback(() => setScreenReady(true), []);

  useEffect(() => {
    let active = true;
    let settled = false;
    const settle = (value: boolean) => {if (active && !settled) {settled = true; setReduced(value);}};
    const timer = setTimeout(() => settle(true), 1500);
    AccessibilityInfo.isReduceMotionEnabled().then(settle).catch(() => settle(true));
    return () => {active = false; clearTimeout(timer);};
  }, []);
  useEffect(() => {
    // Release the native loading surface even if a local asset/font stalls.
    // Destination readiness is checked independently and never bypassed.
    const timer = setTimeout(() => setResourceTimeout(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  const canAnimate = laidOut && (imageReady || resourceTimeout) && reduced !== null && (!!(fontsLoaded || fontError) || resourceTimeout);
  useEffect(() => {
    if (!canAnimate) return;
    let active = true;
    const hideNative = async () => {
      if (Platform.OS === 'web') return;
      try {await SplashScreen.hideAsync();} catch {/* Expo Go may not own a native splash. */}
    };
    const timing = (value: Animated.Value, toValue: number, duration: number, native = true) => Animated.timing(value, {toValue, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: native && Platform.OS !== 'web'});
    void hideNative().finally(() => {
      if (!active) return;
      if (reduced !== false) {
        logo.setValue(0); pin.setValue(1); route.setValue(1); name.setValue(1);
        sequence.current = Animated.delay(4500);
      } else {
        logo.setValue(1); pin.setValue(0); route.setValue(0); name.setValue(0);
        sequence.current = Animated.sequence([
          Animated.parallel([timing(logo, 0, 1000), timing(pin, 1, 1000)]),
          // SVG strokeDashoffset needs the JS driver; only a single path animates.
          timing(route, 1, 1500, false), timing(name, 1, 1000), Animated.delay(1000),
        ]);
      }
      sequence.current.start(({finished}) => {
        if (!finished || !active) return;
        // Keep the completed composition until the destination is ready.
        setCompositionReady(true);
      });
    });
    return () => {active = false; sequence.current?.stop();};
    // canAnimate only changes once; readiness/navigation never restart this sequence.
  }, [canAnimate, reduced, logo, pin, route, name]);
  useEffect(() => {
    if (!compositionReady || !ready || done) return;
    const fade = reduced !== false ? Animated.delay(500) : Animated.timing(opacity, {toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'});
    fade.start(({finished}) => {if (finished) setDone(true);});
    return () => fade.stop();
  }, [compositionReady, ready, reduced, done, opacity]);
  useEffect(() => {
    if (!compositionReady || ready || done) return;
    const timer = setTimeout(() => setWaiting(true), 500);
    return () => clearTimeout(timer);
  }, [compositionReady, ready, done]);

  return <ReadyContext.Provider value={signalReady}>
    <View style={styles.root}>
      <View style={styles.root} pointerEvents={done ? 'auto' : 'none'} accessibilityElementsHidden={!done} importantForAccessibility={done ? 'auto' : 'no-hide-descendants'} aria-hidden={!done}>{children}</View>
      {!done && <Animated.View testID="startup-splash" accessibilityLabel="PATHFINDER is starting" accessibilityRole="progressbar" style={[styles.overlay, {opacity}]} onLayout={() => setLaidOut(true)}>
        <StatusBar style="light" />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, {opacity: logo}]}><Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" onLoadEnd={() => setImageReady(true)} /></Animated.View>
        <View style={{width: Math.min(width - 48, 320), maxWidth: '100%', alignItems: 'center'}}>
          <View style={[styles.graphic, {width: Math.min(width - 48, 280), height: Math.min(height * 0.3, 180)}]}>
            <Svg {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} width="100%" height="100%" viewBox="0 0 280 180">
              <SplashRoute progress={route} />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, {opacity: pin, transform: [{translateY: pin.interpolate({inputRange: [0, 1], outputRange: [10, 0]})}]}]}>
              <Svg {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} width="100%" height="100%" viewBox="0 0 280 180"><Path d="M86 89c0 17-22 34-22 34S42 106 42 89a22 22 0 1 1 44 0Z" fill="#19221c" stroke="#9be570" strokeWidth={2.5} /><Circle cx={64} cy={89} r={7} fill="none" stroke="#9be570" strokeWidth={2.5} /></Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, {opacity: route}]}><Svg {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} width="100%" height="100%" viewBox="0 0 280 180"><Circle cx={238} cy={90} r={5} fill="#9be570" /></Svg></Animated.View>
          </View>
          <Animated.View style={{opacity: name, transform: [{translateY: name.interpolate({inputRange: [0, 1], outputRange: [8, 0]})}]}}><Text style={styles.name}>PATHFINDER</Text></Animated.View>
          {waiting && <View testID="startup-loading" style={styles.loading}>
            {reduced === false && <ActivityIndicator color="#9be570" size="small" />}
            <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Getting your journey ready…</Text>
          </View>}
        </View>
      </Animated.View>}
    </View>
  </ReadyContext.Provider>;
}
const styles = StyleSheet.create({
  root: {flex: 1}, overlay: {...StyleSheet.absoluteFill, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 1000},
  graphic: {maxWidth: '100%'}, center: {alignItems: 'center', justifyContent: 'center'}, logo: {width: 120, height: 120},
  name: {fontFamily: 'Inter_600SemiBold', fontSize: 26, letterSpacing: 3, color: '#edf3ea', textAlign: 'center', marginTop: 12},
  loading: {alignItems: 'center', gap: 12, marginTop: 24}, loadingText: {fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 20, color: '#99a89d', textAlign: 'center'},
});
