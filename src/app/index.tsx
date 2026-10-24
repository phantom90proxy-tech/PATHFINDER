import Pathfinder from '../Pathfinder';
import React, {useEffect, useRef, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from '../components/OnboardingScreen';
import {useTheme} from '../theme';
import {useStartupReady} from '../components/StartupSplash';
export default function Home(){
  const {color} = useTheme();
  const [complete, setComplete] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  useStartupReady(complete !== null || readError);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  useEffect(() => {let active = true; void AsyncStorage.getItem('pathfinder.onboarding.v1').then(value => {if (active) {setComplete(value === 'complete'); setReadError(false);}}).catch(() => {if (active) setReadError(true);}); return () => {active = false;};}, [readAttempt]);
  const finish = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try {await AsyncStorage.setItem('pathfinder.onboarding.v1', 'complete'); setComplete(true);}
    catch {setError('Could not save your welcome preferences. Please try again.');}
    finally {busy.current = false; setSaving(false);}
  };
  if (readError) return <View style={{flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: color('#000000')}}>
    <Text accessibilityRole="header" style={{fontFamily: 'Inter_600SemiBold', fontSize: 22, color: color('#edf3ea')}}>Unable to restore startup preferences</Text>
    <Text accessibilityRole="alert" style={{fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: color('#99a89d')}}>Your stored information has not been changed. Retry to check whether onboarding is already complete.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry startup" onPress={() => {setReadError(false); setReadAttempt(value => value + 1);}} style={{minHeight: 52, borderRadius: 16, backgroundColor: color('#9be570'), alignItems: 'center', justifyContent: 'center'}}><Text style={{fontFamily: 'Inter_600SemiBold', color: '#172510'}}>Retry</Text></Pressable>
  </View>;
  if (complete === null) return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: color('#000000')}}><Text style={{color: color('#99a89d')}}>Restoring startup preferences…</Text></View>;
  return complete || skipped ? <Pathfinder screen="home" /> : <OnboardingScreen onFinish={() => {void finish();}} onSkip={() => setSkipped(true)} saving={saving} error={error} />;
}
