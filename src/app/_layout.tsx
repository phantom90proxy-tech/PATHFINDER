import {Stack} from 'expo-router';
import {Platform} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PrototypeState} from '../PrototypeState';
import {useReducedMotion} from '../hooks/useReducedMotion';
export default function Layout(){
  const reduced = useReducedMotion();
  return <SafeAreaProvider><PrototypeState><Stack screenOptions={{headerShown:false,animation:reduced?'none':'fade',contentStyle:{backgroundColor:'#000000'}}}>
    <Stack.Screen name="search" options={{
      animation: reduced || Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
      animationDuration: 360,
      ...(Platform.OS !== 'ios' ? {presentation: 'transparentModal', contentStyle: {backgroundColor: 'transparent'}} : {}),
    }} />
  </Stack></PrototypeState></SafeAreaProvider>;
}
