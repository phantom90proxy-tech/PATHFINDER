import {useEffect, useRef} from 'react';
import {useNavigation} from 'expo-router';
import Pathfinder from '../Pathfinder';
import {SearchSessionContext, useSearchSession} from '../hooks/useSearchSession';
import '../components/SearchTransition.web.css';

export default function Search() {
  const session = useSearchSession();
  const navigation = useNavigation();
  const screen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let closing: Animation | undefined;
    let allowRemoval = false;
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      session.exit();
      const element = screen.current;
      if (allowRemoval || !element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      event.preventDefault();
      if (closing) return;

      // Start from the current position even if Back is tapped during entry.
      const transform = getComputedStyle(element).transform;
      element.getAnimations().forEach(animation => animation.cancel());
      closing = element.animate([
        {transform},
        {transform: 'translateY(100%)'},
      ], {duration: 360, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards'});
      closing.id = 'search-slide-down';
      closing.finished.then(() => {
        allowRemoval = true;
        navigation.dispatch(event.data.action);
      }).catch(() => {}); // Unmounting cancels the pending animation.
    });
    return () => {unsubscribe(); closing?.cancel();};
  }, [navigation, session]);

  return <SearchSessionContext.Provider value={session}><div ref={screen} className="search-slide"><Pathfinder screen="search" /></div></SearchSessionContext.Provider>;
}
