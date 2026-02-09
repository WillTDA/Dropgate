import { defineConfig } from 'tsup';

const shared = {
  entry: ['src/index.ts'],
  target: 'node20' as const,
  platform: 'node' as const,
  bundle: true,
  minify: false,
  splitting: false,
  noExternal: [/@dropgate\/core/, /fflate/],
  external: ['peerjs'],
  define: {
    'process.env.DROPGATE_CLI_VERSION': '"3.0.4"',
  },
};

export default defineConfig([
  // ESM build (for `node dist/index.js` and npm bin)
  {
    ...shared,
    format: ['esm'],
    sourcemap: true,
    clean: true,
    banner: {
      js: `#!/usr/bin/env node`,
    },
  },
  // CJS build (for pkg executable)
  {
    ...shared,
    format: ['cjs'],
    sourcemap: false,
    clean: false,
  },
]);
