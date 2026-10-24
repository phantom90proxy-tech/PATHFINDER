# Android Studio preparation

Inspected on 2026-10-23. No APK was generated.

## Result

The missing `android/` project was generated using `npx.cmd expo prebuild --platform android --no-install`. No native project existed beforehand, and no existing native customizations were overwritten. The generated folder remains ignored by Git. Application code, navigation, storage, and map services were not changed. Prebuild's automatic changes to the Android/iOS npm scripts were reverted to preserve their existing behavior.

Ready to open for inspection and Gradle sync; a successful native sync, compilation, and installed-device run have NOT been verified. The requested Gradle `help` configuration check was rejected by the approval system before execution.

## Configuration inspected

- Expo 57.0.31; React Native 0.86.3. Expo dependency compatibility check passed; Expo Doctor passed 21/21 checks.
- Application ID and namespace: `com.pathfinder.prototype`; versionName `1.0.0`, versionCode `1`; URI scheme `pathfinder`.
- Generated Gradle wrapper: 9.3.1. Installed React Native version catalog specifies AGP 8.12.0, compile/target SDK 36, min SDK 24 (Android 7), Build Tools 36.0.0, NDK 27.1.12297006. These are the current defaults, not independent version overrides.
- SDK 36 and Build Tools 36.0.0 are installed under `%LOCALAPPDATA%\Android\Sdk`. The required NDK is not currently installed there. Gradle 9.3.1 is not cached locally.
- Shell Java is Oracle 20.0.2. Android Studio bundles JetBrains Java 25.0.3. JAVA_HOME and ANDROID_HOME are unset. Select a compatible Gradle JDK in Android Studio rather than assuming the shell Java is appropriate. No system environment settings were changed.
- Native splash uses the existing image on black, with `SplashScreenManager` registered in MainActivity. Root JS holds the native splash until the custom five-second launch overlay is ready.
- Startup restores `pathfinder.onboarding.v1`: only `complete` bypasses onboarding. Missing flag shows onboarding; read failure shows Retry. Get Started persists completion; Skip does not. No preference was reset during preparation.
- Generated foreground permissions include coarse/fine location and INTERNET; no background-location or location foreground-service permission was requested. GPS is acquired through expo-location after a user action.
- Android maps use bundled Leaflet inside react-native-webview, with HTTPS map tiles/services and native GPS passed into the map. WebView autolinking resolves; react-native-maps remains intentionally excluded on Android. No Google Maps API key is required for this implementation.

## Items to review before distribution

- App icon/adaptive icon are not explicitly configured in app.config.ts. Existing icon and splash assets are Expo placeholders, and generated launcher resources use template artwork. No new branding was invented.
- Prebuild warns that `userInterfaceStyle` needs expo-system-ui for native support. It was not installed as part of this inspection. Existing JS theme controls remain unchanged.
- The generated manifest also contains template/dependency permissions SYSTEM_ALERT_WINDOW, VIBRATE, and legacy READ/WRITE_EXTERNAL_STORAGE capped at SDK 32. Review the final merged release manifest before distribution; these were not removed speculatively.
- Generated release signing currently uses the template debug keystore. It is suitable for local inspection/testing only; choose the existing application's signing identity before distributing an update.
- Keeping local data on upgrade requires the same application ID and signing identity. Do not uninstall the existing app or clear its data to resolve a signing mismatch. This preparation did not touch device storage.

## Open in Android Studio (no APK build required)

1. Open the existing `PATHFINDER/android` folder as a project.
2. Set the Android SDK location to `%LOCALAPPDATA%\Android\Sdk`. Select a Gradle JDK compatible with the generated Gradle/AGP versions under Settings > Build, Execution, Deployment > Build Tools > Gradle.
3. Allow Gradle sync to download its wrapper and dependencies. Install NDK (Side by side) `27.1.12297006` through SDK Manager if requested. Confirm the sync result before selecting any build action.
4. Keep app configuration changes in app.config.ts/config plugins. Do not hand-edit generated native files or use `prebuild --clean` over future native customizations.

## Verification

- Lint and TypeScript: passed.
- Unit tests: 146 passed.
- Android production JS/Hermes export: passed (`dist/android-studio-check`); this is not an APK or a native compile.
- Web production export: passed (`dist-web`).
- Startup/onboarding browser tests: the eight-test targeted run completed successfully (`test-results/.last-run.json` reports passed with no failed tests). Covers onboarding completion/Skip, five-second startup, reduced motion, read errors, and delayed initialization.
- Existing non-fatal Node module-type and NO_COLOR/FORCE_COLOR warnings remain.

## Physical Android checks after a separately authorized build

Use a separate test device/profile for a first-install test so existing data is preserved. Check first launch (five-second animation > onboarding > Get Started > Home), subsequent cold launch (animation > Home), Android Back, background/resume without replay, reduced motion, and preference-read retry behavior. Verify GPS grant/deny/retry, WebView tiles and interaction, route search/alternatives, saved routes/history, and restart recovery. Test without Metro using a release-mode test installation to verify bundled assets and startup independently of development tooling. Offline maps/navigation still require their existing connectivity; saved details are separate.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/), [Local app development](https://docs.expo.dev/guides/local-app-development/).
