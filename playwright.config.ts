import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: {baseURL: 'http://127.0.0.1:8790', viewport: {width:412,height:917},
    storageState: {cookies: [], origins: [{origin: 'http://127.0.0.1:8790', localStorage: [{name: 'pathfinder.onboarding.v1', value: 'complete'}]}]},
    channel: 'msedge', headless: true, screenshot: 'only-on-failure'},
  webServer: {command: 'node scripts/serve-web.cjs', url:'http://127.0.0.1:8790', reuseExistingServer:!process.env.CI},
});
