import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'docs/evidencias/playwright-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/integration/api-bridge.mjs', url: 'http://127.0.0.1:54331/health', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false, env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54331', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-fixture-public-key' } },
  ],
  projects: [{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'tablet',use:{viewport:{width:768,height:1024}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
});
