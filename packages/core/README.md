# tessera

Deep zoom image renderer built with WebGPU. This package provides the main entry point and all functionality.

## Installation

```bash
npm install tessera
# or
pnpm add tessera
# or
yarn add tessera
```

## Usage

```typescript
import { Viewer, RectangleTool, TIFFParser } from 'tessera';

const viewer = new Viewer({
  canvas: document.getElementById('canvas'),
  imageUrl: 'path/to/image.tiff',
});
```

> **Note**: This package is published as `tessera` on npm. Internal packages (`@tessera/*`) are private and should not be imported directly.

