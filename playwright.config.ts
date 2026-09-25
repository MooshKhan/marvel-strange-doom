import {
    defineConfig,
  } from "@playwright/test";
  
  export default defineConfig({
    testDir:
      "./e2e",
  
    fullyParallel:
      false,
  
    workers: 1,
  
    timeout:
      30_000,
  
    expect: {
      timeout:
        5_000,
    },
  
    reporter:
      "list",
  
    use: {
      baseURL:
        "http://127.0.0.1:4173",
  
      trace:
        "retain-on-failure",
    },
  
    webServer: [
      {
        command:
          "npm run e2e:server --prefix server",
  
        url:
          "http://127.0.0.1:3001/api/health",
  
        reuseExistingServer:
          false,
  
        timeout:
          120_000,
      },
  
      {
        command:
          "npm run dev --prefix client -- --host 127.0.0.1 --port 4173 --strictPort",
  
        url:
          "http://127.0.0.1:4173",
  
        reuseExistingServer:
          false,
  
        timeout:
          120_000,
      },
    ],
  });