# Tessera

> A next-generation deep zoom image renderer built with WebGPU for medical imaging, microscopy, and high-precision image viewing applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Overview

Tessera is a professional-grade, browser-based image viewer designed for applications requiring extreme precision, color accuracy, and advanced annotation capabilities. Built with WebGPU (with graceful fallbacks to WebGL and Canvas2D), Tessera handles gigapixel+ images with smooth pan/zoom, maintains color accuracy for diagnostic use, and provides a powerful plugin-based architecture for extensibility.

### Key Differentiators

- 🎨 **Color-accurate rendering** with strict mode for diagnostic use
- 📏 **Unit-aware measurements** with calibration support
- 🔌 **Plugin-based annotation system** (not hardcoded shapes)
- ✏️ **Advanced editing tools** (vertex manipulation, boolean operations, etc.)
- 🚀 **Multi-backend rendering** (WebGPU → WebGL → Canvas2D fallback)
- 🏥 **Medical-grade calibration tools** (spatial, grayscale, color verification)

## Features

### Core Capabilities

- **Deep Zoom Rendering**
  - Multi-level pyramid support (TIFF, Zarr, DICOM, IIIF, custom formats)
  - Smooth hardware-accelerated pan/zoom with momentum
  - Intelligent tile caching with memory management
  - Multiple viewports (synchronized or independent)

- **Color Management**
  - Color-accurate pipeline with linear working space
  - Strict mode for diagnostic applications
  - VOI LUT support (window/level for grayscale medical images)
  - GSDF mapping for consistent perception
  - ICC profile support (source and display)

- **Annotation System**
  - Plugin-based architecture for custom annotation types
  - Multiple annotation types (points, lines, polygons, rectangles, ellipses, splines, text)
  - Image-space coordinates (zoom-invariant)
  - Z-indexing with proper layering
  - Spatial indexing (R-tree) for fast hit-testing
  - Built-in measurement support

- **Drawing Tools**
  - Interactive creation (click-to-create and draw-to-create modes)
  - Shape tools (rectangle, ellipse, polygon, polyline, spline, freehand)
  - Modifier keys (Shift, Alt, Ctrl) for constraints
  - Live preview with rubber-band feedback
  - Undo/redo with transaction-based history
  - Snapping (grid, angles, vertices, edges)

- **Advanced Editing**
  - Vertex manipulation (drag corners, insert/delete vertices)
  - Edge editing (split edges, insert points)
  - Shape transforms (rotate, scale, skew, mirror)
  - Boolean operations (union, intersect, difference, XOR)
  - Fillet/chamfer operations
  - Offset/inset with unit awareness
  - Knife tool for cutting shapes

- **Units & Calibration**
  - Dual coordinate systems (image-space and screen-space)
  - Pluggable unit registry (µm, mm, px, in, etc.)
  - Support for anisotropic pixels (X ≠ Y)
  - Auto-calibration from rulers/grids
  - Dynamic scale bars with proper units

- **Text Annotations**
  - Rich text support (bold, italic, color, underline)
  - Full Unicode emoji support
  - Inline images
  - Multiple layouts (labels, boxes, callouts)
  - Unit-aware sizing
  - Text shaping with HarfBuzz for complex scripts

- **Plugin System**
  - Register custom annotation types
  - Custom renderers (GPU and Canvas2D)
  - Custom drawing/editing tools
  - Custom measurement algorithms
  - Import/export plugins (GeoJSON, WKT, DICOM SR, FHIR)
  - Custom calibration algorithms

## Target Use Cases

1. **Medical Imaging**: DICOM viewers, pathology slides, radiology
2. **Microscopy**: Whole slide imaging (WSI), histology, research microscopy
3. **Scientific Imaging**: Large format scientific imagery with precise measurements
4. **General Deep Zoom**: Any application requiring smooth, accurate deep zoom

## Tech Stack

### Core Technologies

- **TypeScript** - Type-safe development with strict mode
- **WebGPU** (Primary) - Modern GPU API for best performance
- **WebGL2/WebGL** (Fallbacks) - Widely supported, good performance
- **Canvas2D** (Universal Fallback) - Maximum compatibility

### Key Dependencies

- **HarfBuzz (WASM)** - Text shaping for complex scripts
- **Spatial Index** - R-tree implementation for fast hit-testing
- **Boolean Operations** - Polygon clipping library
- **Color Science** - Color space conversions
- **Image Format Support** - TIFF, Zarr, DICOM, IIIF parsers

### Build Tools

- **Bun** - Fast package manager and runtime
- **TypeScript Compiler** - Type checking and compilation
- **Vitest** - Unit testing
- **oxlint & oxfmt** - Code linting and formatting

## Browser Support

### Minimum Requirements

- **Chrome/Edge**: 113+ (WebGPU support)
- **Firefox**: 110+ (WebGPU support)
- **Safari**: 16.4+ (WebGPU support)
- **Fallback**: Any browser with WebGL support

### Feature Detection

Tessera automatically detects available rendering backends and gracefully degrades:
1. WebGPU (best performance)
2. WebGL2 (good performance)
3. WebGL (compatibility)
4. Canvas2D (universal fallback)

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- Bun 1.0.0 or higher

### Install Dependencies

```bash
bun install
```

## Development

### Build

Build all packages:

```bash
bun run build
```

### Testing

Run all tests:

```bash
bun run test
```

### Type Checking

Type check all packages:

```bash
bun run typecheck
```

### Linting & Formatting

Lint code:

```bash
bun run lint
```

Format code:

```bash
bun run format
```

## Project Structure

```
Tessera/
├── packages/          # Core library packages
│   ├── core/         # Main viewer API
│   ├── rendering/    # Rendering engine
│   ├── annotations/  # Annotation system
│   ├── tools/        # Drawing tools
│   ├── geometry/     # Geometry utilities
│   ├── units/        # Units & calibration
│   └── ...
├── docs/             # Project documentation
└── README.md         # This file
```

> **Note**: Demo applications and examples are hosted in separate repositories within the Tessera GitHub organization.

## Quick Start

```typescript
import { Viewer } from '@tessera/core';

// Create a viewer instance
const viewer = new Viewer({
  canvas: document.getElementById('canvas'),
  imageUrl: 'path/to/image.tiff',
});

// Initialize the viewer
await viewer.init();

// Add an annotation
viewer.annotations.add({
  type: 'rectangle',
  geometry: {
    x: 100,
    y: 100,
    width: 200,
    height: 150,
  },
  style: {
    stroke: '#ff0000',
    strokeWidth: 2,
  },
});

// Activate a tool
viewer.tools.activate('rectangle');
```

## Architecture

Tessera follows a modular, plugin-based architecture:

```
Application Layer (React/Vue/Angular/Vanilla)
         ↓
Tessera Core API (Viewer, Annotations, Tools, Events)
         ↓
Rendering Engine / Annotation System / Drawing Tools
         ↓
Backend Abstraction Layer (WebGPU / WebGL2 / WebGL / Canvas2D)
         ↓
Browser APIs
```

For detailed architecture documentation, see [docs/03-architecture.md](docs/03-architecture.md).

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Project Overview](docs/00-project-overview.md)
- [Core Features](docs/01-core-features.md)
- [Tech Stack](docs/02-tech-stack.md)
- [Architecture](docs/03-architecture.md)
- [Modules](docs/04-modules.md)
- [Components](docs/05-components.md)
- [Annotation System](docs/06-annotation-system.md)
- [Drawing Tools](docs/07-drawing-tools.md)
- [Color Management](docs/08-color-management.md)
- [Units System](docs/09-units-system.md)
- [Plugin System](docs/10-plugin-system.md)
- [Folder Structure](docs/11-folder-structure.md)
- [Implementation Guide](docs/12-implementation-guide.md)
- [WebGPU Implementation Details](docs/13-webgpu-implementation-details.md)

## Project Status

**Planning/Brainstorming Phase** - Ready for development

This project is currently in the planning phase. See the [Implementation Guide](docs/12-implementation-guide.md) for the development roadmap.

## Contributing

Contributions are welcome! Please read the documentation first, especially:

1. [Implementation Guide](docs/12-implementation-guide.md) - Development roadmap
2. [Architecture](docs/03-architecture.md) - System design
3. [Plugin System](docs/10-plugin-system.md) - Extending Tessera

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `bun run lint` and `bun run typecheck`
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Resources

### WebGPU
- [WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)

### WebGL
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [WebGL2 Spec](https://www.khronos.org/registry/webgl/specs/latest/2.0/)

### Medical Imaging
- [DICOM Standard](https://www.dicomstandard.org/)
- [DICOM Part 14 (GSDF)](https://www.dicomstandard.org/current/)

### Text Rendering
- [HarfBuzz](https://harfbuzz.github.io/)
- [MSDF Tutorial](https://github.com/Chlumsky/msdfgen)

## Support

For questions or issues:

1. Check the [documentation](docs/) first
2. Review examples in the Tessera organization repositories
3. Check GitHub issues
4. Ask in discussions

---

Built with ❤️ for precision image viewing
