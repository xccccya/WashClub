import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './apps/api/openapi.json',
    output: {
      mode: 'split',
      target: 'packages/api-client/src',
      schemas: 'packages/api-client/src/model',
      client: 'fetch',
      clean: true,
      mock: false,
      override: {
        mutator: {
          path: 'packages/shared-utils/src/http.ts',
          name: 'createHttpClient',
        },
      },
    },
  },
});

