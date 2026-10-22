import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {MapRoute} from '../data/roadRoutes';
import {usePrototype} from '../PrototypeState';

export function SaveJourneyButton({route, reversed = false}: {route: MapRoute; reversed?: boolean}) {
  const {savedJourneys: {state, store}} = usePrototype();
  const identity = `${route.id}:${reversed}`;
  const [feedback, setFeedback] = useState<{identity: string; message: string} | null>(null);
  const message = feedback?.identity === identity ? feedback.message : null;
  return <View style={{gap: 6}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Save selected journey" accessibilityState={{disabled: state.busy}} disabled={state.busy}
      style={[s.button, state.busy && {opacity: 0.6}]} onPress={async () => {
        try {const result = await store.save(route, reversed); setFeedback({identity, message: result === 'duplicate' ? 'This journey is already saved.' : 'Journey saved on this device.'});}
        catch (error) {setFeedback({identity, message: error instanceof Error ? error.message : 'Could not save this journey. Please retry.'});}
      }}><Text style={s.buttonText}>{state.busy ? 'Saving…' : 'Save journey'}</Text></Pressable>
    {message && <Text accessibilityLiveRegion="polite" role="status" style={s.copy}>{message}</Text>}
    <Text style={s.copy}>Saves this journey’s endpoints and route coordinates on this device. No GPS history is saved.</Text>
  </View>;
}
const s = StyleSheet.create({
  button: {minHeight: 48, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#303d34', backgroundColor: '#19221c', alignItems: 'center', justifyContent: 'center'},
  buttonText: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#c3cec5'},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, color: '#99a89d'},
});
