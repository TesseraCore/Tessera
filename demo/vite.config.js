import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      'tessera': resolve(__dirname, '../packages/core/src'),
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
      '@tessera/devtools': resolve(__dirname, '../packages/devtools/src'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
  },
  plugins: [
    {
      name: 'resolve-js-to-ts',
      resolveId(id, importer) {
        // Resolve .js imports to .ts files when importing from our packages
        if (importer && id.endsWith('.js') && !id.startsWith('http') && !id.startsWith('node:')) {
          const tsId = id.replace(/\.js$/, '.ts');
          
          // Handle relative imports
          if (id.startsWith('.')) {
            const importerDir = resolve(importer, '..');
            const tsPath = resolve(importerDir, tsId);
            if (existsSync(tsPath)) {
              return tsPath;
            }
          }
          
          // Handle @tessera/* imports
          const packageAliases = {
            'tessera': resolve(__dirname, '../packages/core/src'),
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
            '@tessera/devtools': resolve(__dirname, '../packages/devtools/src'),
          };
          
          for (const [alias, aliasPath] of Object.entries(packageAliases)) {
            if (id.startsWith(alias + '/')) {
              const relativePath = id.slice(alias.length + 1);
              const tsPath = resolve(aliasPath, relativePath.replace(/\.js$/, '.ts'));
              if (existsSync(tsPath)) {
                return tsPath;
              }
            }
          }
        }
        return null;
      },
    },
  ],
});

