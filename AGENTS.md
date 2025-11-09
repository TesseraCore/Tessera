# AGENTS.md

This document provides guidance for AI agents working with the Tessera codebase. It outlines the project structure, key concepts, conventions, and best practices to help agents understand and modify the code effectively.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Codebase Structure](#codebase-structure)
- [Key Concepts](#key-concepts)
- [Module System](#module-system)
- [Common Tasks](#common-tasks)
- [Code Style & Conventions](#code-style--conventions)
- [Testing](#testing)
- [Important Patterns](#important-patterns)
- [Gotchas & Warnings](#gotchas--warnings)

## Project Overview

**Tessera** is a next-generation deep zoom image renderer built with WebGPU for medical imaging, microscopy, and high-precision image viewing applications.

### Key Characteristics

- **Monorepo Structure**: Uses pnpm workspaces with multiple internal packages
- **Single Published Package**: Only `tessera` (from `packages/core`) is published; all other packages are private
- **Tree-Shaking Optimized**: Explicit named exports throughout for optimal bundle size
- **Plugin-Based Architecture**: Extensible via plugins for annotations, tools, renderers, etc.
- **Multi-Backend Rendering**: WebGPU → WebGL2 → WebGL → Canvas2D fallback chain
- **TypeScript-First**: Strict TypeScript with comprehensive type definitions

### Target Use Cases

1. Medical Imaging (DICOM viewers, pathology slides, radiology)
2. Microscopy (Whole slide imaging, histology, research microscopy)
3. Scientific Imaging (Large format imagery with precise measurements)
4. General Deep Zoom (Any application requiring smooth, accurate deep zoom)

## Architecture

### High-Level Architecture

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

### Core Components

1. **Viewer Core** (`packages/core`): Main entry point, orchestrates all subsystems
2. **Rendering Engine** (`packages/rendering`): Abstract rendering across multiple backends
3. **Annotation System** (`packages/annotations`): Plugin-based annotation management
4. **Tool System** (`packages/tools`): Interactive drawing and editing
5. **Color Management** (`packages/rendering/color`): Accurate color rendering
6. **Units & Calibration** (`packages/units`): Unit-aware measurements
7. **Event System** (`packages/events`): Application integration

## Codebase Structure

### Monorepo Layout

```
Tessera/
├── packages/          # Core library packages (all private except core)
│   ├── core/         # Main viewer API (PUBLISHED as 'tessera')
│   ├── rendering/    # Rendering engine
│   ├── annotations/  # Annotation system
│   ├── tools/        # Drawing/editing tools
│   ├── geometry/     # Geometry utilities
│   ├── units/        # Units & calibration
│   ├── text/         # Text rendering
│   ├── formats/      # Format support
│   ├── import/       # Import plugins
│   ├── export/       # Export plugins
│   ├── graph/        # Overlay graph
│   ├── events/       # Event system
│   ├── utils/        # Shared utilities
│   └── workers/      # Web Workers
├── docs/             # Project documentation
├── demo/             # Demo application
└── tools/            # Build tools
```

### Package Structure Template

Each package follows this structure:

```
package-name/
├── src/
│   ├── index.ts      # Public API exports (explicit named exports)
│   └── ...           # Source files
├── tests/            # Test files
├── package.json      # Package configuration
├── tsconfig.json     # TypeScript configuration
└── README.md         # Package documentation
```

### Key Files

- **`packages/core/src/index.ts`**: Main entry point, re-exports everything from internal packages
- **`docs/`**: Comprehensive documentation (start with `00-project-overview.md`)
- **`package.json`**: Root package.json with workspace configuration
- **`pnpm-workspace.yaml`**: pnpm workspace configuration

## Key Concepts

### 1. Image-Space Coordinates

**Critical**: All annotation geometry is stored in **image-space coordinates**, not screen-space. This ensures:
- Zoom-invariant annotations
- Measurement accuracy
- Consistent behavior across zoom levels

### 2. Immutable Geometry

All annotation geometry is immutable:
- Updates create new objects (structural sharing where possible)
- Enables time-travel debugging and undo/redo
- Transaction-based history

### 3. Plugin Architecture

The system is extensible via plugins:
- **Annotation Types**: Custom shapes/annotations
- **Renderers**: Custom rendering logic (GPU/Canvas)
- **Tools**: Drawing/editing tools
- **Measurers**: Measurement algorithms
- **Importers/Exporters**: File format support
- **Calibrators**: Calibration algorithms

### 4. Backend Abstraction

Rendering backends are abstracted:
- `RenderBackend` interface implemented by WebGPU, WebGL2, WebGL, Canvas2D
- Automatic fallback chain: WebGPU → WebGL2 → WebGL → Canvas2D
- Backend-agnostic rendering code

### 5. Explicit Named Exports

**Critical for Tree-Shaking**: All exports must be explicit named exports:

```typescript
// ✅ Correct: Explicit named exports
export { Viewer } from './viewer.js';
export type { ViewerOptions } from './viewer.js';

// ❌ Incorrect: Default exports or namespace exports
export default Viewer;  // DON'T DO THIS
export * from './viewer.js';  // DON'T DO THIS (unless re-exporting from internal)
```

## Module System

### Module Dependencies

```
tessera (packages/core)
├── @tessera/rendering
│   └── @tessera/utils
├── @tessera/annotations
│   ├── @tessera/rendering
│   ├── @tessera/geometry
│   └── @tessera/events
├── @tessera/tools
│   ├── @tessera/annotations
│   ├── @tessera/geometry
│   └── @tessera/events
├── @tessera/units
│   └── @tessera/geometry
├── @tessera/text
│   ├── @tessera/rendering
│   └── @tessera/annotations
└── @tessera/events
```

### Import Rules

**For End Users** (documented in README):
```typescript
// ✅ Correct: Import from 'tessera'
import { Viewer, RectangleTool, TIFFParser } from 'tessera';

// ❌ Incorrect: Don't import from internal packages
import { RectangleTool } from '@tessera/tools'; // DON'T DO THIS
```

**For Internal Code** (within packages):
```typescript
// ✅ Correct: Import from internal packages
import { RectangleTool } from '@tessera/tools';
import { Point } from '@tessera/geometry';
```

### Package Visibility

- **Public**: `tessera` (from `packages/core`) - published to npm
- **Private**: All other packages (`@tessera/*`) - marked `"private": true` in package.json

## Common Tasks

### Adding a New Annotation Type

1. **Define the type** in `packages/annotations/src/types/`
2. **Create a renderer** (GPU/Canvas)
3. **Register the type** via plugin system
4. **Export from** `packages/annotations/src/index.ts`
5. **Re-export from** `packages/core/src/index.ts`

### Adding a New Tool

1. **Create the tool** in `packages/tools/src/drawing/` or `packages/tools/src/editing/`
2. **Implement the Tool interface**
3. **Export from** `packages/tools/src/index.ts`
4. **Re-export from** `packages/core/src/index.ts`

### Adding a New Format Parser

1. **Create parser** in `packages/formats/src/[format-name]/parser.ts`
2. **Implement TileSource interface**
3. **Register in** `packages/formats/src/registry.ts`
4. **Export from** `packages/formats/src/index.ts`
5. **Re-export from** `packages/core/src/index.ts`

### Adding a New Backend

1. **Create backend** in `packages/rendering/src/backend/[backend-name].ts`
2. **Implement RenderBackend interface**
3. **Add detection logic** in backend factory
4. **Export from** `packages/rendering/src/index.ts`
5. **Re-export from** `packages/core/src/index.ts`

## Code Style & Conventions

### TypeScript

- **Strict Mode**: Always enabled
- **File Extensions**: Use `.js` in imports (TypeScript will resolve `.ts` files)
- **Type Definitions**: Export types explicitly: `export type { MyType }`
- **Interfaces**: Prefer interfaces over type aliases for public APIs

### File Naming

- **Regular files**: `camelCase.ts`
- **Classes/Components**: `PascalCase.ts` (if the file contains a single class)
- **Utilities**: `kebab-case.ts` (optional, camelCase preferred)

### Export Patterns

```typescript
// ✅ Correct: Explicit named exports
export { MyClass } from './my-class.js';
export type { MyInterface } from './my-class.js';

// ✅ Correct: Multiple exports from same file
export { ClassA, ClassB } from './classes.js';
export type { TypeA, TypeB } from './types.js';

// ❌ Incorrect: Default exports
export default MyClass;  // DON'T DO THIS

// ❌ Incorrect: Namespace exports (unless re-exporting)
export * from './my-class.js';  // DON'T DO THIS
```

### Import Patterns

```typescript
// ✅ Correct: Import from internal packages
import { Point } from '@tessera/geometry';
import type { Point } from '@tessera/geometry';

// ✅ Correct: Type-only imports
import type { ViewerOptions } from '@tessera/core';
```

### Code Organization

- **One class/interface per file** (when possible)
- **Co-locate related types** in the same file
- **Group exports** logically in `index.ts`

### Comments

- **JSDoc comments** for public APIs
- **Inline comments** for complex logic
- **TODO comments** are acceptable but should include context

## Testing

### Test Structure

- **Unit tests**: Co-located with source or in `tests/` directory
- **Test files**: `*.test.ts` for unit tests, `*.spec.ts` for integration tests
- **Framework**: Vitest

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter '@tessera/core' test

# Run with coverage
pnpm test:coverage
```

### Test Patterns

```typescript
import { describe, it, expect } from 'vitest';
import { Point } from '@tessera/geometry';

describe('Point', () => {
  it('should create a point', () => {
    const point = new Point(10, 20);
    expect(point.x).toBe(10);
    expect(point.y).toBe(20);
  });
});
```

## Important Patterns

### 1. Backend Abstraction

```typescript
// Backend interface
interface RenderBackend {
  init(canvas: HTMLCanvasElement): Promise<void>;
  renderTiles(tiles: Tile[], view: ViewUniforms): void;
  // ...
}

// Backend implementations
class WebGPUBackend implements RenderBackend { /* ... */ }
class WebGL2Backend implements RenderBackend { /* ... */ }
```

### 2. Plugin Registration

```typescript
// Annotation type registration
viewer.annotations.registerType({
  type: 'custom.shape',
  schema: jsonSchema,
  renderer: customRenderer,
  measurers: [customMeasurer],
});

// Tool registration
viewer.tools.register({
  id: 'tool.custom',
  forType: 'custom.shape',
  onPointerDown(e, ctx) { /* ... */ },
  // ...
});
```

### 3. Transaction-Based Updates

```typescript
// All changes go through transactions
const tx = store.beginTransaction();
tx.add(annotation);
tx.commit();

// Enables undo/redo
store.undo();
store.redo();
```

### 4. Spatial Indexing

```typescript
// R-tree for fast hit-testing
const rtree = new RTree();
rtree.insert(annotation);
const hits = rtree.query(bbox);
const hit = rtree.hitTest(point, tolerance);
```

### 5. Coordinate Transformation

```typescript
// Image-space to screen-space
const screenPoint = viewport.imageToScreen(imagePoint);

// Screen-space to image-space
const imagePoint = viewport.screenToImage(screenPoint);
```

## Gotchas & Warnings

### ⚠️ Critical Warnings

1. **Never import from internal packages in user-facing code**
   - Users should only import from `tessera`
   - Internal packages are private and may change

2. **Always use explicit named exports**
   - Required for tree-shaking
   - Default exports break tree-shaking

3. **Image-space coordinates are mandatory**
   - Never store screen-space coordinates in annotations
   - Always transform coordinates when rendering

4. **Immutable geometry**
   - Never mutate annotation geometry directly
   - Always create new objects for updates

5. **Backend abstraction**
   - Never access WebGPU/WebGL APIs directly
   - Always go through RenderBackend interface

### Common Mistakes

1. **Forgetting to re-export from core**
   - New exports must be added to `packages/core/src/index.ts`

2. **Using default exports**
   - Breaks tree-shaking
   - Use explicit named exports instead

3. **Mixing coordinate spaces**
   - Confusing image-space and screen-space
   - Always check which space you're working in

4. **Mutating immutable data**
   - Modifying annotation geometry directly
   - Use transactions for updates

5. **Direct backend access**
   - Accessing WebGPU/WebGL directly
   - Use RenderBackend interface

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

### Making Changes

1. **Create a feature branch**
2. **Make changes** following conventions
3. **Add tests** for new functionality
4. **Run tests**: `pnpm test`
5. **Type check**: `pnpm typecheck`
6. **Lint**: `pnpm lint`
7. **Format**: `pnpm format`
8. **Commit** with descriptive message

### Build Process

- **TypeScript compilation**: Each package compiles independently
- **Output**: `dist/` directory in each package
- **Bundling**: Handled by consuming applications (tree-shaking enabled)

## Documentation

### Documentation Structure

- **`docs/00-project-overview.md`**: Start here for project overview
- **`docs/03-architecture.md`**: System architecture
- **`docs/04-modules.md`**: Module breakdown
- **`docs/10-plugin-system.md`**: Plugin system guide
- **`docs/11-folder-structure.md`**: Folder structure details

### When to Update Documentation

- Adding new features
- Changing APIs
- Adding new modules
- Changing architecture

## Resources

### External Documentation

- [WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [DICOM Standard](https://www.dicomstandard.org/)
- [HarfBuzz](https://harfbuzz.github.io/)

### Internal Documentation

- See `docs/` directory for comprehensive documentation
- Each package has a `README.md` with package-specific information

## Quick Reference

### Key Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm typecheck        # Type check
pnpm lint             # Lint code
pnpm format           # Format code
pnpm demo             # Run demo app
```

### Key Paths

- **Main entry**: `packages/core/src/index.ts`
- **Documentation**: `docs/`
- **Tests**: `packages/*/tests/`
- **Build output**: `packages/*/dist/`

### Key Interfaces

- `RenderBackend`: Rendering backend abstraction
- `Annotation`: Base annotation interface
- `Tool`: Tool interface
- `TileSource`: Format parser interface
- `ViewUniforms`: Viewport transformation data

---

**Remember**: When in doubt, check the existing codebase patterns and documentation. The codebase follows consistent patterns throughout.

