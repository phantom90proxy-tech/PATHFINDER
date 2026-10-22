import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router} from 'expo-router';
import {usePrototype} from '../PrototypeState';
import {isRoadRoute, routeSummary, snappingNotice, tripTitle, type RoadRoute} from '../data/roadRoutes';
import {transferLabel, serviceInformationDisclosure} from '../services/transportationInformation';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {useRouteFreshnessNow} from '../hooks/useRouteFreshnessNow';
import {routeFreshnessLabel} from '../services/routeFreshness';

function HistoricalAge({route}: {route: RoadRoute}) {
  const now = useRouteFreshnessNow(route.fetchedAt);
  return <Text style={s.copy}>{routeFreshnessLabel(route.fetchedAt, true, now)}</Text>;
}
function Action({label, onPress, disabled = false}: {label: string; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => [s.button, (pressed || disabled) && {opacity: 0.6}]}><Text style={s.action}>{label}</Text></Pressable>;
}

export function JourneyHistoryScreen() {
  const {journeyHistory: {state, store}} = usePrototype();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{kind: 'clear'} | {kind: 'delete'; id: string} | null>(null);
  const journey = state.items.find(item => item.id === selected);
  const clearing = confirmation?.kind === 'clear';
  const title = clearing ? 'Clear History?' : 'Delete history journey?';
  const pendingDelete = confirmation?.kind === 'delete' ? state.items.find(item => item.id === confirmation.id) : null;
  return <View style={s.fill}>
    <View style={s.header}>
      <Action label={journey ? 'Back to journey history' : 'Back to map'} onPress={() => journey ? setSelected(null) : router.dismissTo('/')} />
      <Text accessibilityRole="header" style={s.heading}>{journey ? 'Historical journey' : 'Journey History'}</Text>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.copy}>Your last 20 explicitly selected journeys, newest first, stored only on this device. No background location tracking or unconfirmed searches are recorded.</Text>
      <Text style={s.copy}>Previously retrieved information: routes, travel times, fares and crowd levels may be outdated and are not live. Viewing history does not refresh routes or change the active journey. Offline details do not provide offline maps or navigation.</Text>
      {state.error && <View style={s.card}><Text accessibilityRole="alert" style={s.copy}>{state.error}</Text>
        <Action label="Retry history storage" disabled={state.busy} onPress={() => {void store.load().catch(() => {});}} /></View>}
      {!state.ready && !state.error && <Text role="status" style={s.copy}>Loading journey history…</Text>}
      {state.ready && !journey && state.items.length === 0 && <View style={s.card}><Text style={s.heading}>No journey history yet</Text><Text style={s.copy}>Select a route or confirm it with View selected route on map to add it here.</Text></View>}
      {journey ? <View style={s.card} testID="history-journey-details">
        <Text accessibilityRole="header" style={s.heading}>{tripTitle(journey.route)}</Text>
        <Text style={s.copy}>{journey.route.label} · {routeSummary(journey.route)}</Text>
        <Text style={s.copy}>Last selected {new Date(journey.selectedAt).toLocaleString()}</Text>
        {isRoadRoute(journey.route) ? <><HistoricalAge route={journey.route} />
          <Text style={s.copy}>Historical OSRM driving estimate. No live traffic, transit, fare or crowd data.</Text>
          {snappingNotice(journey.route) && <Text style={s.copy}>{snappingNotice(journey.route)}</Text>}</> : <><Text style={s.copy}>{transferLabel(journey.route)}</Text><Text style={s.copy}>Transit demo: predefined sample service, fare, time and crowd level. Not live public transport.</Text></>}
        <Text style={s.copy}>{serviceInformationDisclosure}</Text>
        <Text style={s.copy}>Origin: {journey.route.origin}</Text><Text style={s.copy}>Destination: {journey.route.destination}</Text>
        <Text style={s.copy}>Location and map data: © OpenStreetMap contributors.</Text>
        <Action label="Delete history journey" disabled={state.busy} onPress={() => setConfirmation({kind: 'delete', id: journey.id})} />
      </View> : state.items.map(item => <View key={item.id} style={s.card} testID="history-entry">
        <Text style={s.heading}>{tripTitle(item.route)}</Text><Text style={s.copy}>{item.route.label} · {routeSummary(item.route)}</Text>
        <Text style={s.copy}>Last selected {new Date(item.selectedAt).toLocaleString()}</Text>
        <Action label={`Open history journey ${tripTitle(item.route)} ${item.route.label}`} onPress={() => setSelected(item.id)} />
        <Action label={`Delete history journey ${tripTitle(item.route)} ${item.route.label}`} disabled={state.busy} onPress={() => setConfirmation({kind: 'delete', id: item.id})} />
      </View>)}
      <Action label="Clear History" disabled={state.busy || (state.ready && state.items.length === 0)} onPress={() => setConfirmation({kind: 'clear'})} />
    </ScrollView>
    <Modal visible={confirmation !== null} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setConfirmation(null)}>
      <View style={s.backdrop}><View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={title} style={s.dialog}>
        <Text accessibilityRole="header" style={s.heading}>{title}</Text>
        <Text style={s.copy}>{clearing ? 'All journey history on this device will be removed, including unreadable history data.' : pendingDelete ? `${tripTitle(pendingDelete.route)} will be removed from history.` : ''} Saved routes and the active journey stay unchanged.</Text>
        <Action label="Cancel history deletion" onPress={() => setConfirmation(null)} />
        <Action label={clearing ? 'Confirm clear history' : 'Confirm delete history journey'} disabled={state.busy} onPress={async () => {
          try {
            if (clearing) {await store.clear(); setSelected(null);}
            else if (pendingDelete) {await store.remove(pendingDelete.id); if (selected === pendingDelete.id) setSelected(null);}
          } catch {/* The store preserves the previous list and displays the error. */}
          finally {setConfirmation(null);}
        }} />
      </View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  fill: {flex: 1, backgroundColor: '#000000'}, header: {padding: 16, gap: 12},
  content: {padding: 16, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center'},
  heading: {fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, color: '#edf3ea'},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#b6c1b9'},
  card: {padding: 16, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#303d34', backgroundColor: '#19221c'},
  button: {minHeight: 48, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#425343', backgroundColor: '#19221c', justifyContent: 'center', alignItems: 'center'},
  action: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#9be570'},
  backdrop: {flex: 1, padding: 24, backgroundColor: '#000a', justifyContent: 'center'},
  dialog: {width: '100%', maxWidth: 420, alignSelf: 'center', padding: 24, gap: 16, borderRadius: 24, backgroundColor: '#1c261f'},
});
