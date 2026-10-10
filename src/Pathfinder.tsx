import React from 'react';
import {StatusBar, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {router} from 'expo-router';
import {useFonts, Inter_300Light, Inter_500Medium, Inter_600SemiBold} from '@expo-google-fonts/inter';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HomeScreen} from './components/HomeScreen';
import {SearchScreen} from './components/SearchScreen';

export default function Pathfinder({screen, onReturnHome}: {screen: 'home' | 'search'; onReturnHome?: () => void}) {
  const dimensions = useWindowDimensions(), insets = useSafeAreaInsets();
  const height = dimensions.height - insets.top - insets.bottom;
  const [loaded, error] = useFonts({Inter_300Light, Inter_500Medium, Inter_600SemiBold});
  if (!loaded && !error) return <View style={[s.fill, s.center]}><Text style={{color: '#9be570'}}>PATHFINDER</Text></View>;
  return <View style={[s.fill, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
    <StatusBar barStyle="light-content" />
    {screen === 'home' ? <HomeScreen width={dimensions.width} height={height} /> : <SearchScreen onReturnHome={onReturnHome ?? (() => router.dismissTo('/'))} />}
  </View>;
}
const s = StyleSheet.create({fill: {flex: 1, backgroundColor: '#000000'}, center: {alignItems: 'center', justifyContent: 'center'}});
