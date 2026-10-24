import React from 'react';
import {Animated} from 'react-native';
import {Path} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
export function SplashRoute({progress}: {progress: Animated.Value}) {
  return <AnimatedPath d="M64 123 C98 168 139 66 176 105 S222 144 238 90" fill="none" stroke="#9be570" strokeWidth={3} strokeLinecap="round" strokeDasharray={[300, 300]} strokeDashoffset={progress.interpolate({inputRange: [0, 1], outputRange: [300, 0]})} />;
}
