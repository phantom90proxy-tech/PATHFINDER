import React, {useRef, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {resetOnboardingForDevelopment} from '../services/devOnboardingReset';
import {useThemeStyles} from '../theme';
import {useReducedMotion} from '../hooks/useReducedMotion';

export function DevOnboardingReset() {
  const s = useThemeStyles(styles);
  const reduced = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{error: boolean; text: string} | null>(null);
  const pending = useRef(false);
  if (!__DEV__) return null;
  const reset = async () => {
    if (!__DEV__ || pending.current) return;
    pending.current = true; setBusy(true); setFeedback(null);
    try {
      await resetOnboardingForDevelopment(AsyncStorage, __DEV__);
      setFeedback({error: false, text: 'Onboarding reset successfully. Fully close and reopen PATHFINDER to see onboarding again.'});
      setConfirming(false);
    } catch (error) {
      setFeedback({error: true, text: error instanceof Error ? `Reset failed: ${error.message}` : 'Reset failed. Please retry.'});
    } finally {pending.current = false; setBusy(false);}
  };
  const close = () => {if (!pending.current) {setConfirming(false); setFeedback(null);}};
  return <View style={s.section}>
    <Text style={s.eyebrow}>DEVELOPMENT</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Reset Onboarding (DEV)" onPress={() => {setFeedback(null); setConfirming(true);}} style={s.button}><Text style={s.label}>Reset Onboarding (DEV)</Text></Pressable>
    <Modal visible={confirming || feedback !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
      <View style={s.backdrop}>
        <View testID="onboarding-reset-dialog" accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={feedback ? feedback.error ? 'Onboarding reset failed' : 'Onboarding reset complete' : 'Reset onboarding?'} style={s.dialog}>
          <ScrollView contentContainerStyle={s.confirmation} showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" style={s.title}>{feedback ? feedback.error ? 'Reset failed' : 'Onboarding reset' : 'Reset onboarding?'}</Text>
            {feedback ? <Text role={feedback.error ? 'alert' : 'status'} accessibilityLiveRegion="polite" style={s.copy}>{feedback.text}</Text> : <Text style={s.copy}>Remove only the onboarding completion preference? Saved routes, journey history, and other settings will stay unchanged. You will remain on Profile.</Text>}
            <View style={s.actions}>
              {(!feedback || feedback.error) && <Pressable accessibilityRole="button" accessibilityLabel={feedback ? 'Retry onboarding reset' : 'Confirm onboarding reset'} disabled={busy} accessibilityState={{disabled: busy}} onPress={() => {void reset();}} style={[s.button, s.grow, busy && s.disabled]}><Text style={s.label}>{busy ? 'Resetting…' : feedback ? 'Retry' : 'Reset'}</Text></Pressable>}
              <Pressable accessibilityRole="button" accessibilityLabel={feedback ? 'Dismiss onboarding reset result' : 'Cancel onboarding reset'} disabled={busy} accessibilityState={{disabled: busy}} onPress={close} style={[s.button, s.grow, busy && s.disabled]}><Text style={s.label}>{feedback ? 'Done' : 'Cancel'}</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  section: {gap: 10, borderTopWidth: 1, borderColor: '#334039', paddingTop: 16, marginTop: 8},
  eyebrow: {fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.4, color: '#91a096'},
  button: {minHeight: 48, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#425343', backgroundColor: '#141e18', alignItems: 'center', justifyContent: 'center'},
  label: {fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 20, color: '#9be570'},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d'},
  confirmation: {gap: 12}, actions: {flexDirection: 'row', gap: 10}, grow: {flex: 1}, disabled: {opacity: 0.5},
  backdrop: {flex: 1, backgroundColor: '#000a', padding: 24, justifyContent: 'center', alignItems: 'center'},
  dialog: {width: '100%', maxWidth: 400, maxHeight: '80%', padding: 24, borderRadius: 24, backgroundColor: '#19221c', borderWidth: 1, borderColor: '#425343'},
  title: {fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, color: '#edf3ea'},
});
