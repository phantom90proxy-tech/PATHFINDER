
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'PATHFINDER',
  slug: 'pathfinder',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',

  // Android and iOS
  ios: {
    bundleIdentifier: 'com.pathfinder.prototype',
    supportsTablet: false,
  },

  android: {
    package: 'com.pathfinder.prototype',
    predictiveBackGestureEnabled: false,
  },

  // Vercel website favicon
  web: {
    favicon: './public/favicon.png',
  },

  scheme: 'pathfinder',

  // Expo account
  owner: 'wiseproxy',

  // EAS project
  extra: {
    eas: {
      projectId: '7982d4d1-7028-4ad4-a206-447990a33b2e',
    },
  },

  plugins: [
    'expo-router',
    'expo-font',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow PATHFINDER to show your position and use it as a route origin when you ask.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],
};

export default config;

