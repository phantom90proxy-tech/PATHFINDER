import React, {useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import * as Linking from 'expo-linking';
import Svg, {Path} from 'react-native-svg';
import type {MapRoute, LocationFix} from '../data/roadRoutes';
import {googleMapsURL, openGoogleMaps} from '../services/googleMaps';

export function GoogleMapsButton({route, reversed = false, location = null}: {route: MapRoute; reversed?: boolean; location?: LocationFix | null}) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const busy = useRef(false);
  const open = async () => {
    if (busy.current) return;
    busy.current = true; setOpening(true); setError(null);
    try {
      const url = googleMapsURL(route, reversed, location);
      await openGoogleMaps(url, {platform: Platform.OS, openURL: Linking.openURL, openTab: target => {
        const tab = window.open('about:blank', '_blank');
        if (!tab) return false;
        try {tab.opener = null; tab.location.replace(target); return true;}
        catch {tab.close(); return false;}
      }});
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Could not open Google Maps. Please try again.');}
    finally {busy.current = false; setOpening(false);}
  };
  return <View style={s.group}>
    <Pressable accessibilityRole="button" accessibilityLabel="Navigate with Google Maps" accessibilityHint="Opens external driving directions" accessibilityState={{disabled: opening}} disabled={opening} onPress={open} style={({pressed}) => [s.button, (pressed || opening) && s.pressed]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9be570" strokeWidth={1.7} strokeLinejoin="round" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})}><Path d="m21 3-7 18-3-8-8-3 18-7Z" /></Svg>
      <Text style={s.label}>Navigate with Google Maps</Text>
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#99a89d" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})}><Path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></Svg>
    </Pressable>
    <Text style={s.note}>Google Maps provides driving directions and available traffic estimates. Its route may differ, including from transit demos. You may need to tap Start in Google Maps.</Text>
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
const s = StyleSheet.create({
  group: {gap: 8, marginVertical: 8},
  button: {minHeight: 54, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#6f9e53', backgroundColor: '#19221c'},
  label: {flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#9be570'},
  note: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d'},
  error: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, color: '#edf3ea'}, pressed: {opacity: 0.7},
});
