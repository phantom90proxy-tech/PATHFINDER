import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFonts, Inter_500Medium, Inter_600SemiBold} from '@expo-google-fonts/inter';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {useTheme, useThemeStyles} from '../theme';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

const slides = [
  {image: require('../../assets/onboarding-images/1.png'), title: 'Your journey.\nYour way.', copy: 'Welcome to PATHFINDER. Make yourself at home with an appearance that feels right for you.', label: 'WELCOME TO PATHFINDER'},
  {image: require('../../assets/onboarding-images/2.png'), title: 'Plan a little.\nExplore a lot.', copy: 'Find route options, save your go-to journeys, and revisit your recent trips in one place.', label: 'A SIMPLER WAY TO PLAN'},
  {image: require('../../assets/onboarding-images/3.png'), title: 'See your route.\nFind your way.', copy: 'Explore your journey on the map with driving estimates and sample transit routes.', label: 'READY FOR YOUR NEXT RIDE'},
];

function PageIndicator({active, label, disabled, onPress}: {active: boolean; label: string; disabled: boolean; onPress: () => void}) {
  const s = useThemeStyles(styles);
  const {color, mode} = useTheme();
  const reduced = useReducedMotion();
  const [animation] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(animation, {toValue: active ? 1 : 0, duration: reduced ? 0 : 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: false}).start();
    return () => animation.stopAnimation();
  }, [active, reduced, animation]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected: active, disabled}} aria-pressed={active} disabled={disabled} onPress={onPress} style={s.dotTarget}>
    <Animated.View style={[s.dot, {width: animation.interpolate({inputRange: [0, 1], outputRange: [6, 24]}), backgroundColor: animation.interpolate({inputRange: [0, 1], outputRange: [color('#425343'), color('#9be570')]}), opacity: animation.interpolate({inputRange: [0, 1], outputRange: [mode === 'dark' ? 0.8 : 1, 1]})}]} />
  </Pressable>;
}

export default function OnboardingScreen({onFinish, onSkip, saving, error}: {onFinish: () => void; onSkip: () => void; saving: boolean; error: string | null}) {
  const s = useThemeStyles(styles);
  const {color} = useTheme();
  const {width, height} = useWindowDimensions();
  const reduced = useReducedMotion();
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [progress] = useState(() => new Animated.Value(1));
  const [loaded, fontError] = useFonts({Inter_500Medium, Inter_600SemiBold});
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(reduced ? 1 : 0);
    Animated.timing(progress, {toValue: 1, duration: reduced ? 0 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start();
    return () => progress.stopAnimation();
  }, [index, reduced, progress]);
  const go = (next: number) => {
    if (next === index || saving) return;
    pager.current?.scrollTo({x: next * width, animated: !reduced});
    setIndex(next);
  };
  if (!loaded && !fontError) return <SafeAreaView style={s.screen} />;
  return <SafeAreaView style={s.screen} testID="onboarding">
    <View style={s.surface}>
    <ScrollView bounces={false} horizontal pagingEnabled ref={pager} showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill} scrollEnabled={!saving} onLayout={() => pager.current?.scrollTo({x: index * width, animated: false})} onMomentumScrollEnd={event => {
      const next = Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
      if (next !== index) setIndex(next);
    }}>
      {slides.map((slide, position) => <View key={slide.label} style={{width, height: '100%'}} accessibilityElementsHidden={index !== position} importantForAccessibility={index !== position ? 'no-hide-descendants' : 'auto'} aria-hidden={index !== position}>
        <Image source={slide.image} resizeMode="cover" style={s.image} accessibilityLabel={position === 0 ? 'PATHFINDER profile and appearance preview' : position === 1 ? 'PATHFINDER journey menu preview' : 'PATHFINDER route map preview'} />
        <Svg {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} style={[StyleSheet.absoluteFill, {pointerEvents: 'none'}]} width="100%" height="100%"><Defs><LinearGradient id={`onboarding-shade-${position}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color('#000000')} stopOpacity={0.25} /><Stop offset="0.45" stopColor={color('#000000')} stopOpacity={0.05} /><Stop offset="0.72" stopColor={color('#000000')} stopOpacity={0.88} /><Stop offset="1" stopColor={color('#000000')} stopOpacity={1} /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#onboarding-shade-${position})`} /></Svg>
      </View>)}
    </ScrollView>
    <Animated.View testID="onboarding-caption" style={[s.copy, {pointerEvents: 'none', bottom: Math.max(160, height * 0.22), opacity: progress, transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [reduced ? 0 : 16, 0]})}]}]}>
      <Text accessibilityRole="header" style={s.title}>{slides[index].title}</Text><Text style={s.description}>{slides[index].copy}</Text>
    </Animated.View>
    <View style={s.header}>{index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Previous onboarding page" disabled={saving} onPress={() => go(index - 1)} style={s.skip}><Text style={s.skipText}>← Back</Text></Pressable> : <View />}<Pressable accessibilityRole="button" accessibilityLabel="Skip onboarding" disabled={saving} onPress={onSkip} style={s.skip}><Text style={s.skipText}>Skip</Text></Pressable></View>
    <View style={s.footer}>
      <View style={s.progressRow}><View style={s.dots}>{slides.map((slide, position) => <PageIndicator key={slide.label} active={index === position} label={`Onboarding page ${position + 1}`} disabled={saving} onPress={() => go(position)} />)}</View></View>
      {error && <Text accessibilityRole="alert" style={s.description}>{error}</Text>}
      <View style={s.actions}><Pressable accessibilityRole="button" accessibilityLabel={index === 2 ? 'Get started' : 'Next onboarding page'} accessibilityState={{disabled: saving}} disabled={saving} onPress={() => index === 2 ? onFinish() : go(index + 1)} style={({pressed}) => [s.next, (pressed || saving) && {opacity: 0.7}]}><Text style={s.nextText}>{saving ? 'Getting ready…' : index === 2 ? 'Get started' : 'Next'}</Text></Pressable></View>
    </View>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#000000'}, surface: {flex: 1}, header: {position: 'absolute', top: 8, left: 0, right: 0, paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  brand: {fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 2, color: '#edf3ea'}, skip: {minWidth: 48, minHeight: 48, paddingHorizontal: 12, borderRadius: 24, backgroundColor: '#19221cf2', borderWidth: 1, borderColor: '#334039', alignItems: 'center', justifyContent: 'center'}, skipText: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#99a89d'},
  image: {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'},
  copy: {position: 'absolute', left: 24, right: 24, gap: 12, maxWidth: 552},
  title: {fontFamily: 'Inter_600SemiBold', fontSize: 32, lineHeight: 38, letterSpacing: -1.2, color: '#edf3ea'}, description: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#99a89d'},
  footer: {position: 'absolute', bottom: 16, paddingHorizontal: 24, paddingBottom: 16, gap: 12, width: '100%', maxWidth: 600, alignSelf: 'center'}, progressRow: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}, dots: {flexDirection: 'row'}, dotTarget: {minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center'}, dot: {height: 6, width: 6, borderRadius: 6, backgroundColor: '#425343'}, activeDot: {width: 24, backgroundColor: '#9be570'},
  actions: {flexDirection: 'row', gap: 12}, next: {flex: 1, minHeight: 54, backgroundColor: '#9be570', borderRadius: 32, justifyContent: 'center', alignItems: 'center'}, nextText: {fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#172510'},
});
