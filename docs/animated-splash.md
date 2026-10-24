PATHFINDER startup animation
===========================

The root layout retains Android's native splash until the React overlay has
laid out, the existing splash image has loaded (or failed), and the Inter font
has loaded (or failed). Both layers use the branded black background and the
existing unmodified assets/splash-icon.png at 120 logical pixels.

The overlay fades that image out, fades/slides a location pin in, draws one
curved SVG path, reveals PATHFINDER, holds, then fades over the mounted initial
screen. The motion takes five seconds, excluding native resource loading:
0–1s pin reveal, 1–2.5s route draw, 2.5–3.5s name reveal, 3.5–4.5s hold,
4.5–5s fade into the ready initial screen. If initialization is slow, the
composition becomes a safe loading state at five seconds and waits for readiness.
A two-second asset timeout prevents fonts or the image from indefinitely holding
the native loading surface. It never bypasses destination readiness.
GPS, map tiles, Photon and OSRM are not prerequisites for the animation.

Reduced motion shows the completed composition for five seconds without the draw/slide
sequence. The overlay lives once in the root layout; navigation and background
resume do not recreate it. A process restart or full web reload does replay it.
SVG drawing uses the JS animation driver; transforms and opacity use the native
driver on Android. Web uses the JS driver. No routing/storage services changed.

Onboarding state is read from the existing pathfinder.onboarding.v1 key. First
launch displays onboarding after the splash; completed users go directly home.
Only Get Started on the final page saves completion before entering Home.
Skip opens Home for the current session without changing the completion flag.
Onboarding is a conditional root screen, not a pushed route, so completion leaves
no onboarding/splash entry on the back stack. A failed preference read presents
Retry rather than assuming the user is new or changing any stored data.

Physical Android verification
-----------------------------

1. Build a new internal APK using the existing EAS preview profile:
   `npx eas-cli@latest build --platform android --profile preview`
2. Download and install the APK from the EAS build link on the phone.
3. Force-stop PATHFINDER, then launch from the launcher. Check that the native
   logo hands off to the pin/route/name animation without a white or blank frame.
4. Check both outcomes: first-launch onboarding and returning-user home.
5. Open details, saved routes, history and the menu, then return home. Background
   and resume the app. The startup animation must not replay.
6. Enable Android's accessibility setting to remove animations and cold-launch
   again. Confirm the short static composition replaces the motion sequence.
7. Repeat offline and with Light mode selected; the startup branding stays dark,
   then fades into the saved appearance. Check small screens and larger font sizes.

This workflow does not require local Android Studio or generated native folders.
No EAS build is started automatically. Expo Go can preview the React animation,
but Expo Go/development builds do not faithfully reproduce Android's native
splash. Final handoff/masking/frame pacing must be verified in the installed APK.
See https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/.

Validation commands
-------------------

`npx expo lint`
`npx tsc --noEmit`
`npm test`
`npx expo export --platform web --output-dir dist-web`
`npx expo export --platform android --output-dir dist/startup-android`
`npx playwright test e2e/startup-splash.spec.ts e2e/onboarding.spec.ts e2e/appearance.spec.ts e2e/route-details.spec.ts e2e/side-menu.spec.ts`

Development-only onboarding reset
--------------------------------

In a development session (`__DEV__ === true`), open Profile and scroll to
DEVELOPMENT → Reset Onboarding (DEV). Confirm Reset. Success is displayed only
after removal and a verification read both succeed for pathfinder.onboarding.v1.
Saved routes, history and other preferences are not touched. No navigation or
restart occurs. Fully close the app and reopen it to test Splash → Onboarding.
Get Started persists completion again; Skip remains session-only.

The control and its dependency are conditionally excluded from release builds.
It is not available in an internal preview/release APK. Use Expo Go or an existing
development build for Android testing; no new APK is needed for this task.

`npx playwright test --config playwright.dev.config.ts` tests the development
control using a separate Metro server and isolated browser storage.
`npx playwright test e2e/production-dev-controls.spec.ts` checks its absence in
the production web export. Node tests verify that only the onboarding key is
removed and that production calls fail before touching storage.
