import {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Easing, Keyboard, useWindowDimensions} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import Pathfinder from '../Pathfinder';
import {SearchSessionContext, useSearchSession} from '../hooks/useSearchSession';

export default function AndroidSearchScreen() {
  const session = useSearchSession();
  const {height} = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(1));
  const reduced = useRef(true);
  const closing = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const enter = (value: boolean) => {
      if (!mounted.current || closing.current) return;
      reduced.current = value;
      Animated.timing(progress, {
        toValue: 0, duration: value ? 0 : 360,
        easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true,
      }).start();
    };
    // Wait for the preference so the initial conservative value doesn't skip entry.
    AccessibilityInfo.isReduceMotionEnabled().then(enter).catch(() => enter(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      reduced.current = value;
      if (value && !closing.current) {progress.stopAnimation(); progress.setValue(0);}
    });
    return () => {mounted.current = false; subscription.remove(); progress.stopAnimation();};
  }, [progress]);

  const returnHome = useCallback(() => {
    session.exit();
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    // Keep the route mounted until the native-driven exit is complete.
    Animated.timing(progress, {
      toValue: 1, duration: reduced.current ? 0 : 360,
      easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true,
    }).start(({finished}) => {
      if (finished && mounted.current) router.dismissTo('/');
    });
  }, [progress, session]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnHome();
      return true;
    });
    return () => subscription.remove();
  }, [returnHome]));

  return <Animated.View style={{flex: 1, transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, height]})}]}}>
    <SearchSessionContext.Provider value={session}><Pathfinder screen="search" onReturnHome={returnHome} /></SearchSessionContext.Provider>
  </Animated.View>;
}
