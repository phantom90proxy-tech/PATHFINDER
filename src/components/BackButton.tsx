import React from 'react';
import {Platform, Pressable, StyleSheet} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useTheme, useThemeStyles} from '../theme';

export function BackButton({label, onPress}: {label: string; onPress: () => void}) {
  const s = useThemeStyles(styles);
  const {mode} = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed}) => [s.button, pressed && {opacity: 0.7}]}>
    <Svg {...(Platform.OS === 'web' ? {'aria-hidden': true, focusable: false} : {accessible: false})} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : '#9be570'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M19 12H5m6-6-6 6 6 6" /></Svg>
  </Pressable>;
}
const styles = StyleSheet.create({button: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#1c2620', alignItems: 'center', justifyContent: 'center'}});
