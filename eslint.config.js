// ESLint v9+ uses the "flat config" format by default.
// This repo currently doesn't enforce lint rules yet; this config is intentionally minimal
// to ensure `pnpm lint` can run without failing due to missing configuration.
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.output/**',
      '**/.next/**',
      '**/uploads/**',
      'packages/api-client/src/generated/**',
    ],
  },
];


