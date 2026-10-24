import {useThemeStyles} from '../theme';
import {BackButton} from './BackButton';
import React, {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router, useFocusEffect, useNavigation} from 'expo-router';
import {usePrototype} from '../PrototypeState';
import {isRoadRoute, routeSummary, snappingNotice, tripTitle} from '../data/roadRoutes';
import {transferLabel, serviceInformationDisclosure} from '../services/transportationInformation';
import {routeFreshnessLabel} from '../services/routeFreshness';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {useRouteFreshnessNow} from '../hooks/useRouteFreshnessNow';
import {createSavedRouteRefresher} from '../services/savedRouteRefresh';
import {requestRoadRoutes} from '../services/roadRoutingClient';

function SavedAge({fetchedAt}: {fetchedAt: number}) {
  const s = useThemeStyles(baseStyles);
  const now = useRouteFreshnessNow(fetchedAt);
  return <Text style={s.copy}>{routeFreshnessLabel(fetchedAt, true, now)}</Text>;
}

function Action({label, onPress, disabled = false}: {label: string; onPress: () => void; disabled?: boolean}) {
  const s = useThemeStyles(baseStyles);

  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => [s.button, (pressed || disabled) && {opacity: 0.6}]}><Text style={s.action}>{label}</Text></Pressable>;
}

export function SavedRoutesScreen() {
  const s = useThemeStyles(baseStyles);
  const {savedJourneys: {state, store}} = usePrototype();
  const [refresher] = useState(() => createSavedRouteRefresher(store, requestRoadRoutes));
  const refresh = useSyncExternalStore(refresher.subscribe, refresher.getSnapshot, refresher.getSnapshot);
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => () => refresher.cancel(), [refresher]));
  useEffect(() => navigation.addListener('beforeRemove', () => refresher.cancel()), [navigation, refresher]);
  useEffect(() => store.subscribe(() => refresher.check()), [store, refresher]);
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const journey = state.items.find(item => item.id === selected);
  const pendingDelete = state.items.find(item => item.id === deleting);
  return <View style={s.fill}>
    <View style={s.header}><BackButton label="Go back" onPress={() => {refresher.reset(); if (journey) setSelected(null); else router.dismissTo('/');}} />
      <Text accessibilityRole="header" style={s.heading}>{journey ? 'Saved journey' : 'Saved routes'}</Text></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.copy}>Saved details are available offline. Maps and navigation still require their own connectivity. Travel times, routes, and sample fares or crowds may be outdated.</Text>
      {state.error && <View style={s.card}><Text accessibilityRole="alert" style={s.copy}>{state.error}</Text>
        <Action label="Retry saved storage" disabled={state.busy} onPress={() => {void store.load().catch(() => {});}} /></View>}
      {!state.ready && !state.error && <Text role="status" style={s.copy}>Loading saved journeys…</Text>}
      {state.ready && !journey && state.items.length === 0 && <View style={s.card}><Text style={s.heading}>No saved journeys yet</Text><Text style={s.copy}>Find and select a route, then choose Save journey from results or route details.</Text></View>}
      {journey ? <View style={s.card} testID="saved-journey-details">
        <Text accessibilityRole="header" style={s.heading}>{tripTitle(journey.route)}</Text>
        <Text style={s.copy}>{journey.route.label}</Text>
        <Text style={s.copy}>{routeSummary(journey.route)}</Text>
        <Text style={s.copy}>{serviceInformationDisclosure}</Text>
        <Text style={s.copy}>Saved {new Date(journey.savedAt).toLocaleString()}</Text>
        {isRoadRoute(journey.route) ? <><SavedAge fetchedAt={journey.route.fetchedAt} />
          <Text style={s.copy}>Saved OSRM driving estimate. No live traffic, public transport, fare or crowd estimates.</Text>
          <Action label="Refresh Route" disabled={!state.ready || state.busy || refresh.phase === 'loading' || refresh.phase === 'saving' || refresh.phase === 'confirm'} onPress={() => {void refresher.start(journey);}} />
          {refresh.message && <Text accessibilityRole={refresh.phase === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" role={refresh.phase === 'error' ? 'alert' : 'status'} style={s.copy}>{refresh.message}</Text>}
          {refresh.phase === 'loading' && <Action label="Cancel refresh" onPress={() => refresher.cancel()} />}
          {refresh.phase === 'confirm' && <>
            {refresh.candidates.map(candidate => <View key={candidate.id} style={{gap: 8}}><Text style={s.copy}>{candidate.label}: {routeSummary(candidate)}. Retrieved {new Date(candidate.fetchedAt).toLocaleString()}. No live traffic.</Text>
              <Action label={`Confirm replacement with ${candidate.label}`} onPress={() => {void refresher.confirm(candidate.id);}} /></View>)}
            <Action label="Keep original saved route" onPress={() => refresher.cancel('Replacement cancelled. Original saved route was kept.')} />
          </>}
          {snappingNotice(journey.route) && <Text style={s.copy}>{snappingNotice(journey.route)}</Text>}</> : <><Text style={s.copy}>{transferLabel(journey.route)}</Text><Text style={s.copy}>Transit demo: predefined sample route, fare, time, transfers and crowd level. Not live public transport.</Text></>}
        <Text style={s.copy}>Origin: {journey.route.origin}</Text><Text style={s.copy}>Destination: {journey.route.destination}</Text>
        <Text style={s.copy}>Location and map data: © OpenStreetMap contributors. Opening saved details does not refresh this journey or change the active trip.</Text>
        <Action label="Delete saved journey" disabled={state.busy} onPress={() => {refresher.cancel(); setDeleting(journey.id);}} />
      </View> : state.items.map(item => <View key={item.id} style={s.card}>
        <Text style={s.heading}>{tripTitle(item.route)}</Text><Text style={s.copy}>{item.route.label} · {routeSummary(item.route)}</Text>
        <Action label={`Open saved journey ${tripTitle(item.route)} ${item.route.label}`} onPress={() => {refresher.reset(); setSelected(item.id);}} />
        <Action label={`Delete saved journey ${tripTitle(item.route)} ${item.route.label}`} disabled={state.busy} onPress={() => setDeleting(item.id)} />
      </View>)}
      <Action label={journey ? 'Back to saved routes' : 'Back to map'} onPress={() => {refresher.reset(); if (journey) setSelected(null); else router.dismissTo('/');}} />
    </ScrollView>
    <Modal visible={!!pendingDelete} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setDeleting(null)}>
      <View style={s.backdrop}><View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel="Delete saved journey?" style={s.dialog}>
        <Text accessibilityRole="header" style={s.heading}>Delete saved journey?</Text>
        <Text style={s.copy}>{pendingDelete ? tripTitle(pendingDelete.route) : ''} will be removed from this device.</Text>
        <Action label="Cancel deletion" onPress={() => setDeleting(null)} />
        <Action label="Confirm delete journey" disabled={state.busy} onPress={async () => {
          if (!pendingDelete) return;
          try {await store.remove(pendingDelete.id); if (selected === pendingDelete.id) setSelected(null);}
          catch {/* The store exposes the error without discarding the journey. */}
          finally {setDeleting(null);}
        }} />
      </View></View>
    </Modal>
  </View>;
}
const baseStyles = StyleSheet.create({

  fill: {flex: 1, backgroundColor: '#000000'}, header: {padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center'},
  content: {padding: 16, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center'},
  heading: {fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, color: '#edf3ea'},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#b6c1b9'},
  card: {padding: 16, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#303d34', backgroundColor: '#19221c'},
  button: {minHeight: 48, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#425343', backgroundColor: '#19221c', justifyContent: 'center', alignItems: 'center'},
  action: {fontFamily: 'Inter_500Medium', fontSize: 13, color: '#9be570'},
  backdrop: {flex: 1, padding: 24, backgroundColor: '#000a', justifyContent: 'center'},
  dialog: {width: '100%', maxWidth: 420, alignSelf: 'center', padding: 24, gap: 16, borderRadius: 24, backgroundColor: '#1c261f'},
});
