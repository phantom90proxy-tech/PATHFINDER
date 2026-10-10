import React, {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {AppState, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {nativeMapHTML} from '../map/nativeLeaflet';
import {createMapSession, type CameraAction} from '../map/mapSession';
import {isRoadRoute, routeSummary, tripEndpoints, routeLabel} from '../data/roadRoutes';
import type {MapHandle, RouteMapProps} from './RouteMap.types';
export type {MapHandle, RouteMapProps} from './RouteMap.types';

export const RouteMap = forwardRef<MapHandle, RouteMapProps>(function RouteMap({route, routes, reversed, location, overlays, reducedMotion, onSelect}, ref) {
  const web = useRef<WebView>(null);
  const [session] = useState(() => createMapSession());
  const [status, setStatus] = useState(session.snapshot);
  const {generation} = status;
  const sent = useRef<{generation: number; geometry: string} | null>(null);
  const source = useMemo(() => ({html: nativeMapHTML(generation)}), [generation]);
  const geometry = useMemo(() => JSON.stringify(routes.map(item => ({...item, label: routeLabel(item, reversed), endpoints: tripEndpoints(item, reversed), road: isRoadRoute(item), summary: routeSummary(item)}))), [routes, reversed]);
  const payload = useMemo(() => ({selected: route?.id, reversed, location, top: overlays?.top ?? 84, bottom: overlays?.bottom ?? 200, reduced: reducedMotion}), [route?.id, reversed, location, overlays, reducedMotion]);
  useEffect(() => {
    session.subscribe(setStatus);
    session.start();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && session.snapshot().status === 'ready') web.current?.injectJavaScript('window.pathfinder?.resume();true;');
    });
    return () => {session.dispose(); subscription.remove();};
  }, [session]);
  useEffect(() => {
    if (status.status !== 'ready') return;
    const changed = sent.current?.generation !== generation || sent.current.geometry !== geometry;
    const camera = session.takeCamera(generation);
    web.current?.injectJavaScript(`window.pathfinder?.update({...${JSON.stringify(payload)}${changed ? ',routes:' + geometry : ''}});${cameraScript(camera)}true;`);
    sent.current = {generation, geometry};
  }, [payload, geometry, status.status, generation, session]);
  useImperativeHandle(ref, () => {
    const move = (action: CameraAction) => {
      session.queueCamera(action);
      const currentGeneration = session.snapshot().generation;
      // Ready can arrive before the first React effect sends geometry. Apply
      // queued camera intent after that initial fit, never before it.
      if (sent.current?.generation !== currentGeneration) return;
      const camera = session.takeCamera(currentGeneration);
      if (camera) web.current?.injectJavaScript(cameraScript(camera) + 'true;');
    };
    return {recenter: () => move({type: 'fit'}), centerOnLocation: point => move({type: 'locate', point})};
  }, [session]);
  return <View style={StyleSheet.absoluteFill}>
    {generation > 0 && <WebView key={generation} ref={web} testID="interactive-map" source={source} style={{flex: 1, backgroundColor: '#080f10'}}
      originWhitelist={['*']} javaScriptEnabled domStorageEnabled cacheEnabled cacheMode="LOAD_DEFAULT"
      applicationNameForUserAgent="PATHFINDER/1.0" geolocationEnabled={false} mixedContentMode="never" setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank' || request.url.startsWith('data:text/html')) return true;
        if (['https://www.openstreetmap.org/copyright', 'https://www.openstreetmap.org/fixthemap', 'https://project-osrm.org/', 'https://project-osrm.org'].includes(request.url)) void Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      onMessage={event => {
        const data = session.receive(event.nativeEvent.data);
        if (data?.type === 'select' && data.id && routes.some(item => item.id === data.id)) onSelect(data.id);
      }}
      onError={() => session.fail(generation, 'Map could not load. Tap Retry map to reload it.')}
      onRenderProcessGone={() => session.fail(generation, 'The map was interrupted. Tap Retry map to reload it.')} />}
    {status.status === 'failed' && <View style={{position: 'absolute', top: 90, left: 16, right: 16, padding: 16, backgroundColor: '#19221c'}}><Text accessibilityRole="alert" style={{color: '#fff'}}>{status.error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry map" onPress={() => session.start()} style={{padding: 14}}><Text style={{color: '#9be570'}}>Retry map</Text></Pressable></View>}
  </View>;
});

function cameraScript(action: CameraAction | null) {
  return !action ? '' : action.type === 'fit' ? 'window.pathfinder?.fit();' : `window.pathfinder?.locate(${JSON.stringify(action.point)});`;
}
