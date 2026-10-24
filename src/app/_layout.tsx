import {Stack} from 'expo-router';
import {Platform} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PrototypeState} from '../PrototypeState';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {ThemeProvider, useTheme} from '../theme';
import {StatusBar} from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {StartupSplash} from '../components/StartupSplash';
if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function Layout(){
  return <ThemeProvider><AppLayout /></ThemeProvider>;
}
function AppLayout(){
  const {mode, color} = useTheme();
  const reduced = useReducedMotion();
  return <SafeAreaProvider><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><PrototypeState><StartupSplash><Stack screenOptions={{headerShown:false,animation:reduced?'none':'fade',contentStyle:{backgroundColor:color('#000000')}}}>
    <Stack.Screen name="search" options={{
      animation: reduced || Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
      animationDuration: 360,
      ...(Platform.OS !== 'ios' ? {presentation: 'transparentModal', contentStyle: {backgroundColor: 'transparent'}} : {}),
    }} />
  </Stack></StartupSplash></PrototypeState></SafeAreaProvider>;
}
