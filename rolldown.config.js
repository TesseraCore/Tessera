import { visualizer } from 'rollup-plugin-visualizer';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

// Get all packages
const packagesDir = join(process.cwd(), 'packages');
const packages = readdirSync(packagesDir).filter((dir) => {
  const packagePath = join(packagesDir, dir);
  return statSync(packagePath).isDirectory();
});

// Create bundle configs for each package
const configs = packages
  .map((pkg) => {
    const packagePath = join(packagesDir, pkg);
    const input = join(packagePath, 'src', 'index.ts');
    
    // Skip if index.ts doesn't exist
    if (!existsSync(input)) {
      return null;
    }
    
    return {
      input,
      output: {
        file: join(packagePath, 'dist', 'bundle.js'),
        format: 'es',
        sourcemap: true,
      },
      // Rolldown has built-in TypeScript and node resolve support
      // Just need to configure externals and add visualizer plugin
      external: (id) => {
        // Externalize workspace packages and node built-ins
        if (id.startsWith('@tessera/')) return true;
        if (id.startsWith('node:')) return true;
        return false;
      },
      plugins: [
        visualizer({
          filename: join(packagePath, 'dist', 'bundle-stats.html'),
          open: false,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
      ],
    };
  })
  .filter(Boolean); // Remove null entries

export default configs;

