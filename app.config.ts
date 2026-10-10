import type {ExpoConfig} from 'expo/config';
const config:ExpoConfig={
  name:'PATHFINDER',slug:'pathfinder',version:'1.0.0',orientation:'portrait',userInterfaceStyle:'dark',
  ios:{bundleIdentifier:'com.pathfinder.prototype',supportsTablet:false},
  android:{package:'com.pathfinder.prototype',predictiveBackGestureEnabled:false},
  scheme:'pathfinder',
  owner:'proxywise2',
  extra:{eas:{projectId:'19e182a0-9950-41af-87f3-1fc50d50b83d'}},
  plugins:['expo-router','expo-font','expo-asset',['expo-location',{
    locationWhenInUsePermission:'Allow PATHFINDER to show your position and use it as a route origin when you ask.',
    isAndroidBackgroundLocationEnabled:false,isAndroidForegroundServiceEnabled:false,isIosBackgroundLocationEnabled:false,
  }]],
};
export default config;
