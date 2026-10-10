SearchScreen SVG investigation — 9 October 2026

Reproduced in Expo Web development mode, before changing application code:

```text
Received `false` for a non-boolean attribute `accessible`.

If you want to write it to the DOM, pass a string instead:
accessible="false" or accessible={value.toString()}.

If you used to conditionally omit it with accessible={condition && value},
pass accessible={condition ? value : undefined} instead.
```

Metro identified this component stack in the original source:

```text
Icon (src/components/SearchScreen.tsx:26:10)
SearchScreen (src/components/SearchScreen.tsx:98:126)
Pathfinder (src/Pathfinder.tsx:16:84)
Search (src/app/search.web.tsx:38:100)
Layout (src/app/_layout.tsx:8:44)
```

The user supplied a source excerpt rather than the exception text or platform. The message above was independently reproduced locally; a different device exception would still need its full message.

Root cause: `accessible={false}` is a native accessibility prop. The installed SVG Web implementation passes it through to the DOM, where React reports it as an invalid boolean attribute. Development mode emits a console error and Metro source frame, although the icons still render. Production browser tests alone did not catch this development diagnostic.

The default `Svg` and named `Circle`, `Path`, and `Rect` imports are correct. The fragment containing two circles and the conditional SVG shapes render successfully; their path lengths are finite and positive in the browser. There was no evidence that drawing props or geometry caused this error.

The installed dependency tree has one deduplicated `react-native-svg@15.15.4`, matching both Expo 57.0.27's local `bundledNativeModules.json` and the [SDK 57 SVG documentation](https://docs.expo.dev/versions/v57.0.0/sdk/svg/). No dependency upgrade or native rebuild was needed for this Web prop correction.

Small fix: decorative SVGs now receive `aria-hidden={true}` and `focusable={false}` on Web, with `accessible={false}` retained on native. React Native Web translates the focusable prop into `tabindex="-1"`. The same issue existed on the search background SVG and discovery icons, so all three call sites were corrected. No drawing, styling, layout, Home, routing, GPS, or map logic was changed.

Files changed for this investigation:

- `src/components/SearchScreen.tsx`: icon and background SVG accessibility props only.
- `src/components/RouteDiscovery.tsx`: Platform import and decorative icon accessibility props only.
- `e2e/search-svg.spec.ts`: new regression covering console errors, uncaught exceptions, SVG semantics, fragment circles, rectangles, and path rendering.
- `docs/search-svg-debugging.md`: this report.

Validation:

- TypeScript and source-focused ESLint passed.
- All 25 unit tests passed.
- The new browser regression failed before the fix and passed afterward against Expo Web development mode, with no console errors or uncaught exceptions.
- Web and Android Hermes exports passed; both map-isolation checks passed.
- The complete exported-browser suite passed: 34 tests.

To exercise development diagnostics again, start `npx.cmd expo start --web --port 8082`, then run in PowerShell:

```powershell
$env:PATHFINDER_SVG_TEST_URL='http://localhost:8082'
npx.cmd playwright test e2e/search-svg.spec.ts
Remove-Item Env:PATHFINDER_SVG_TEST_URL
```

The standard browser suite also runs the regression against the production Web export. Tile requests are intercepted with a local fixture. The unrelated existing pointerEvents deprecation warning remains.

Platform conclusion: the reproduced invalid DOM attribute diagnostic is Web-specific. Native accessibility behavior is preserved. Android bundling succeeded, but no physical Android runtime test was performed; this does not establish that any unspecified Android exception is resolved. No EAS cloud build was started.
