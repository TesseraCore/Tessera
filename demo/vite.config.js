import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './demo',
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@tessera/core': resolve(__dirname, '../packages/core/src'),
      '@tessera/rendering': resolve(__dirname, '../packages/rendering/src'),
      '@tessera/annotations': resolve(__dirname, '../packages/annotations/src'),
      '@tessera/tools': resolve(__dirname, '../packages/tools/src'),
      '@tessera/events': resolve(__dirname, '../packages/events/src'),
      '@tessera/units': resolve(__dirname, '../packages/units/src'),
      '@tessera/utils': resolve(__dirname, '../packages/utils/src'),
      '@tessera/geometry': resolve(__dirname, '../packages/geometry/src'),
      '@tessera/text': resolve(__dirname, '../packages/text/src'),
      '@tessera/graph': resolve(__dirname, '../packages/graph/src'),
      '@tessera/formats': resolve(__dirname, '../packages/formats/src'),
      '@tessera/import': resolve(__dirname, '../packages/import/src'),
      '@tessera/export': resolve(__dirname, '../packages/export/src'),
      '@tessera/workers': resolve(__dirname, '../packages/workers/src'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@tessera/core',
      '@tessera/rendering',
      '@tessera/annotations',
      '@tessera/tools',
      '@tessera/events',
      '@tessera/units',
      '@tessera/utils',
      '@tessera/geometry',
      '@tessera/text',
      '@tessera/graph',
      '@tessera/formats',
      '@tessera/import',
      '@tessera/export',
      '@tessera/workers',
    ],
  },
});

