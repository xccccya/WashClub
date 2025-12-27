import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './apps/api/openapi.json',
    output: {
      mode: 'split',
      // 生成物放到独立目录，避免 clean 时误删手写入口/适配层
      target: 'packages/api-client/src/generated',
      schemas: 'packages/api-client/src/generated/model',
      client: 'fetch',
      clean: true,
      mock: false,
      override: {
        mutator: {
          // 通过 api-client 内部的 mutator 转发到 @wash/shared-utils，避免生成物跨包相对引用 ../../shared-utils/src/...
          path: 'packages/api-client/src/http-mutator.ts',
          name: 'createHttpClient',
        },
      },
    },
  },
});

