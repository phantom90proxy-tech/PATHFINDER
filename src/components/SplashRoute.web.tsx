import React, {useEffect, useRef} from 'react';
import type {Animated} from 'react-native';

// Animated.createAnimatedComponent injects the native-only `collapsable` prop.
// Update just the SVG attribute on web; keep the same Animated.Value/timeline.
export function SplashRoute({progress}: {progress: Animated.Value}) {
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    const listener = progress.addListener(({value}) => path.current?.setAttribute('stroke-dashoffset', String(300 * (1 - value))));
    return () => progress.removeListener(listener);
  }, [progress]);
  return <path ref={path} d="M64 123 C98 168 139 66 176 105 S222 144 238 90" fill="none" stroke="#9be570" strokeWidth={3} strokeLinecap="round" strokeDasharray="300 300" strokeDashoffset={300} />;
}
