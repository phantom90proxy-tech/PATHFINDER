import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e-dev', workers: 1, timeout: 45000,
  use: {baseURL: 'http://127.0.0.1:8791', viewport: {width: 412, height: 917}, channel: 'msedge', headless: true,
    storageState: {cookies: [], origins: [{origin: 'http://127.0.0.1:8791', localStorage: [
      {name: 'pathfinder.onboarding.v1', value: 'complete'},
      {name: 'pathfinder.saved-journeys.v1', value: '{"version":1,"items":[]}'},
      {name: 'pathfinder.journey-history.v1', value: '{"version":1,"items":[]}'},
      {name: 'pathfinder.appearance', value: 'light'},
    ]}]},
  },
  webServer: {command: 'node node_modules/expo/bin/cli start --web --port 8791', url: 'http://127.0.0.1:8791', reuseExistingServer: !process.env.CI},
});
