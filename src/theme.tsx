import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, type TextStyle, type ViewStyle, type ImageStyle} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Mode = 'dark' | 'light';
const light: Record<string, string> = {
  '#000': '#dce3d8', '#000000': '#dce3d8', '#191919': '#e7ece2', '#19221c': '#e7ece2', '#1c2620': '#cddac6', '#1c261f': '#e3e9de',
  '#111b15': '#dce3d8', '#141e18': '#d6e0cf', '#1b2720': '#e3e9de', '#222c25': '#d6e0cf', '#242d27': '#e3e9de', '#202923': '#e3e9de',
  '#253722': '#c9ddbc', '#243829': '#c9ddbc', '#26372b': '#d1dfc7', '#15251a': '#d6e0cf', '#253027': '#d1dfc7', '#2a3d24': '#c9ddbc', '#29372c': '#cddac6',
  '#17201a': '#e3e9de', '#222e24': '#ccddc2', '#2b372f': '#b6c5ad', '#29352d': '#becbb6', '#edf2ed': '#172510',
  '#9be570': '#91bd73', '#7ed957': '#91bd73', '#b8f28b': '#386b27',
  '#a5e582': '#386b27', '#466144': '#718a64',
  '#334039': '#cbd8c6', '#303d34': '#cbd8c6', '#425343': '#b6c9ae', '#3a473d': '#cbd8c6', '#354138': '#cbd8c6', '#465249': '#b6c9ae', '#2c3b31': '#d3dfce', '#3e5941': '#b6c9ae',
  '#edf3ea': '#172510', '#f2f6f0': '#172510', '#f0f5f0': '#172510', '#e0e8df': '#253722', '#fff': '#172510', '#ffffff': '#172510', '#f1f6ee': '#172510', '#e5ede2': '#253722', '#eef4ed': '#172510',
  '#99a89d': '#576b52', '#91a096': '#576b52', '#b6c1b9': '#455c40', '#a9b5ac': '#576b52', '#c1cdc3': '#455c40', '#c3cec5': '#455c40', '#bccabf': '#455c40', '#b5c8b6': '#455c40', '#a9b6ae': '#576b52', '#a9c998': '#386b27', '#94a398': '#576b52',
};
export function themeColor(value: string, mode: Mode): string {
  if (mode === 'dark') return value;
  const key = value.toLowerCase();
  if (light[key]) return light[key];
  if (/^#[0-9a-f]{8}$/.test(key) && light[key.slice(0, 7)]) return light[key.slice(0, 7)] + key.slice(7);
  return value;
}
const Context = createContext({mode: 'dark' as Mode, setMode: (_mode: Mode) => {}, error: null as string | null});
export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [mode, updateMode] = useState<Mode>('dark');
  const [error, setError] = useState<string | null>(null);
  const edited = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {let active = true; void AsyncStorage.getItem('pathfinder.appearance').then(value => {if (active && !edited.current && (value === 'dark' || value === 'light')) updateMode(value);}).catch(() => {}); return () => {active = false;};}, []);
  const setMode = (next: Mode) => {
    edited.current = true; updateMode(next); setError(null);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem('pathfinder.appearance', next)).catch(() => {setError('Appearance changed, but could not be saved. Please try again.');});
  };
  return <Context.Provider value={{mode, setMode, error}}>{children}</Context.Provider>;
}
export function useTheme() {
  const context = useContext(Context);
  return {...context, color: (value: string) => themeColor(value, context.mode)};
}
type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;
export function useThemeStyles<T extends Styles>(base: T): T {
  const {mode} = useTheme();
  return useMemo(() => {
    if (mode === 'dark') return base;
    return Object.fromEntries(Object.entries(base).map(([name, style]) => [name, Object.fromEntries(Object.entries(StyleSheet.flatten(style)).map(([key, value]) => [key, typeof value === 'string' && /color|fill|stroke/i.test(key) ? key === 'color' && ['#9be570', '#7ed957', '#b8f28b'].includes(value) ? '#386b27' : themeColor(value, mode) : value]))])) as T;
  }, [base, mode]);
}
