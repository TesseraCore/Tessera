# Tessera Demo

A simple demo application for local testing of the Tessera image viewer.

## Prerequisites

- Node.js 18.0.0 or higher
- pnpm 8.0.0 or higher

## Setup

First, install dependencies for the demo:

```bash
cd demo
pnpm install
```

## Running the Demo

Start the development server:

```bash
# From the root directory
pnpm demo

# Or from the demo directory
cd demo
pnpm dev
```

The demo will be available at `http://localhost:3000` and should open automatically in your browser.

## Features

The demo includes:

- **Viewer Initialization**: Tests the basic viewer setup with WebGPU/WebGL/Canvas2D fallback
- **Test Image Loading**: Creates and loads a test checkerboard image
- **Pan & Zoom**: Mouse drag to pan, mouse wheel to zoom
- **Controls**: Buttons for zoom in/out and reset view
- **Status Display**: Shows current backend, ready state, and image dimensions

## Browser Support

- **Chrome/Edge**: 113+ (WebGPU support)
- **Firefox**: 110+ (WebGPU support)
- **Safari**: 16.4+ (WebGPU support)
- **Fallback**: Any browser with WebGL support

## Troubleshooting

If you encounter issues:

1. Check that dependencies are installed: `pnpm install` (in the demo directory)
2. Check the browser console for errors
3. Ensure you're using a supported browser version
4. Make sure Vite can resolve the TypeScript source files from the packages

