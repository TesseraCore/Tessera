export default {
  // Check all packages in the monorepo
  packages: ['./packages/**'],
  
  // Write mode - update package.json files
  write: false,
  
  // Include dev dependencies
  dev: true,
  
  // Include peer dependencies
  peer: false,
  
  // Check for major, minor, and patch updates
  mode: 'default',
  
  // Ignore certain packages
  ignore: [
    'typescript', // Keep TypeScript version consistent
  ],
  
  // Group similar updates
  group: true,
  
  // Output format
  output: 'markdown',
};

