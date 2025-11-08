# Package Dependencies & Architecture

## Overview

Tessera uses a monorepo structure where `tessera` is the **only published package**. All other packages are internal and marked as `private: true`. This ensures:

1. **Single entry point**: Users only need to install `tessera`
2. **No circular dependencies**: Strict dependency flow prevents cycles
3. **Simplified versioning**: One version number for the entire library
4. **Tree-shaking support**: Explicit named exports ensure optimal tree-shaking

### How Users Access Features from Private Packages

**All features are accessible** through `tessera`, even though internal packages are private:

```typescript
// ✅ Users install only one package
import { 
  Viewer,              // from tessera
  WebGPUBackend,       // from @tessera/rendering (private)
  AnnotationStore,     // from @tessera/annotations (private)
  RectangleTool,       // from @tessera/tools (private)
  TIFFParser,          // from @tessera/formats (private)
  importGeoJSON,        // from @tessera/import (private)
  exportSVG,           // from @tessera/export (private)
  EventEmitter,        // from @tessera/events (private)
  UnitRegistry,        // from @tessera/units (private)
  Point,               // from @tessera/geometry (private)
} from 'tessera';

// ❌ Users should NOT import from private packages directly
import { AnnotationStore } from '@tessera/annotations'; // DON'T DO THIS
```

**Tree-shaking**: Because `tessera` uses explicit named re-exports, bundlers can eliminate unused code:

```typescript
// Only Viewer and RectangleTool will be included in the bundle
import { Viewer, RectangleTool } from 'tessera';
// TIFFParser, AnnotationStore, etc. will be tree-shaken out
```

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    tessera (PUBLISHED)                         │
│                    Single Entry Point                           │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  rendering    │  │ annotations   │  │    tools      │
│  (private)    │  │  (private)    │  │  (private)    │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│    utils      │  │  geometry     │  │    events     │
│  (private)    │  │  (private)    │  │  (private)    │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │
        │                   │
        └───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│    units      │  │     text      │  │    graph      │
│  (private)    │  │  (private)    │  │  (private)    │
└───────────────┘  └───────────────┘  └───────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   formats     │  │    import     │  │    export     │
│  (private)    │  │  (private)    │  │  (private)    │
└───────────────┘  └───────────────┘  └───────────────┘
                            │
                            │
                            ▼
                    ┌───────────────┐
                    │   workers     │
                    │  (private)    │
                    └───────────────┘
```

## Dependency Rules

### ✅ Required Dependencies (MUST connect)

These dependencies are **required** and form the core architecture:

1. **tessera** → All packages
   - The main package depends on everything to re-export it
   - This is the only package that can import from multiple sources

2. **@tessera/rendering** → @tessera/utils
   - Rendering needs basic utilities (math, color)

3. **@tessera/annotations** → @tessera/rendering, @tessera/geometry, @tessera/events
   - Annotations need rendering for display
   - Annotations need geometry for spatial operations
   - Annotations need events for change notifications

4. **@tessera/tools** → @tessera/annotations, @tessera/geometry, @tessera/events
   - Tools create/modify annotations
   - Tools use geometry for operations
   - Tools emit events

5. **@tessera/units** → @tessera/geometry
   - Units need geometry for calibration calculations

6. **@tessera/text** → @tessera/rendering, @tessera/annotations
   - Text needs rendering for display
   - Text annotations are part of annotation system

7. **@tessera/graph** → @tessera/annotations, @tessera/geometry
   - Graph system works with annotations
   - Graph uses geometry for operations

8. **@tessera/formats** → @tessera/rendering
   - Formats provide tile sources to rendering

9. **@tessera/import** → @tessera/annotations
   - Import creates annotations

10. **@tessera/export** → @tessera/annotations, @tessera/rendering
    - Export reads annotations
    - Export may need rendering for visual export

11. **@tessera/workers** → @tessera/geometry
    - Workers perform geometry operations

### ❌ Forbidden Dependencies (MUST NOT connect)

**Important**: "Forbidden" means these packages **cannot directly import from each other** in their source code. This prevents circular dependencies. However, **users can access all features** through `tessera`, which imports from all packages.

**Example**: 
- ❌ `@tessera/rendering` cannot import from `@tessera/annotations` in its source code
- ✅ Users can import both `WebGPUBackend` and `AnnotationStore` from `tessera`
- ✅ `tessera` can import from both (it's the aggregator)

These restrictions prevent circular dependencies:

1. **@tessera/rendering** ❌ @tessera/annotations
   - Rendering should NOT know about annotations directly
   - Annotations depend on rendering, not vice versa
   - **User access**: Both available via `tessera`

2. **@tessera/geometry** ❌ Any package except @tessera/utils
   - Geometry is a pure math library
   - Should not depend on higher-level concepts
   - **User access**: Geometry utilities available via `tessera`

3. **@tessera/utils** ❌ Any package
   - Utils is the foundation layer
   - Nothing should depend on utils except rendering
   - **User access**: Utils available via `tessera`

4. **@tessera/events** ❌ Any package
   - Events is a pure event system
   - Other packages use it, but it doesn't use them
   - **User access**: EventEmitter available via `tessera`

5. **@tessera/formats** ❌ @tessera/annotations
   - Formats should be independent of annotations
   - Formats provide data, annotations consume it
   - **User access**: Both available via `tessera`

6. **@tessera/import** ❌ @tessera/rendering
   - Import only creates annotations
   - Should not depend on rendering
   - **User access**: Import functions available via `tessera`

7. **@tessera/workers** ❌ Any package except @tessera/geometry
   - Workers are isolated computation units
   - Only depend on geometry for operations
   - **User access**: Workers available via `tessera`

### ⚠️ Optional Dependencies (CAN connect, but not required)

These are potential future connections that are allowed but not currently used:

1. **@tessera/tools** → @tessera/units (optional)
   - Tools could use units for unit-aware operations
   - Currently not implemented

2. **@tessera/annotations** → @tessera/units (optional)
   - Annotations could store unit information
   - Currently not implemented

## Dependency Layers

Packages are organized into **layers** to prevent circular dependencies:

### Layer 0: Foundation (no dependencies)
- `@tessera/utils` - Pure utilities
- `@tessera/events` - Event system
- `@tessera/geometry` - Pure math

### Layer 1: Core Infrastructure
- `@tessera/rendering` - Depends on Layer 0
- `@tessera/units` - Depends on Layer 0

### Layer 2: Domain Logic
- `@tessera/annotations` - Depends on Layer 0, 1
- `@tessera/tools` - Depends on Layer 0, 2 (annotations)
- `@tessera/text` - Depends on Layer 1, 2
- `@tessera/graph` - Depends on Layer 0, 2

### Layer 3: Format & I/O
- `@tessera/formats` - Depends on Layer 1
- `@tessera/import` - Depends on Layer 2
- `@tessera/export` - Depends on Layer 1, 2
- `@tessera/workers` - Depends on Layer 0

### Layer 4: Public API
- `tessera` - Depends on all layers (the published package)

## Dependency Flow Rules

### Rule 1: Unidirectional Flow
Dependencies must flow **downward** only:
- Layer 4 → Layer 3 → Layer 2 → Layer 1 → Layer 0
- Never upward or sideways

### Rule 2: No Circular Dependencies
If Package A depends on Package B, Package B **cannot** depend on Package A.

### Rule 3: Foundation Independence
Layer 0 packages (`utils`, `events`, `geometry`) must not depend on any other internal packages.

### Rule 4: Main Package Aggregation
Only `tessera` (the published package) can depend on multiple packages from different layers.

## Visual Dependency Matrix

| Package | utils | events | geometry | rendering | units | annotations | tools | text | graph | formats | import | export | workers |
|---------|-------|--------|----------|-----------|-------|-------------|-------|------|-------|---------|--------|--------|---------|
| **utils** | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **events** | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **geometry** | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **rendering** | ✅ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **units** | ❌ | ❌ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **annotations** | ❌ | ✅ | ✅ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **tools** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **text** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ |
| **graph** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ |
| **formats** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ |
| **import** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | - | ❌ | ❌ |
| **export** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ |
| **workers** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **tessera** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend:
- ✅ = Required dependency
- ❌ = Forbidden dependency
- - = Self (no self-dependency)

## Adding New Dependencies

When adding a new dependency between packages:

1. **Check the layer**: Ensure the dependency flows downward
2. **Check for cycles**: Use `pnpm why` or dependency analysis tools
3. **Update this document**: Add the dependency to the matrix
4. **Update package.json**: Add the dependency with `workspace:*`
5. **Test**: Ensure builds and tests still pass

## Tree-Shaking Pattern

### Explicit Named Exports (Required)

All packages MUST use explicit named exports for optimal tree-shaking:

```typescript
// ✅ Good: Explicit named exports
// packages/rendering/src/index.ts
export { WebGPUBackend } from './backend/webgpu.js';
export { WebGL2Backend } from './backend/webgl2.js';
export { TileManager } from './tiles/manager.js';

// ✅ Good: Core re-exports using explicit names
// packages/core/src/index.ts
export {
  WebGPUBackend,
  WebGL2Backend,
  TileManager,
} from '@tessera/rendering';

// ❌ Bad: Wildcard exports (can prevent tree-shaking)
export * from '@tessera/rendering'; // AVOID THIS
```

### Tree-Shaking in Action

```typescript
// User code - only imports what's needed
import { Viewer, RectangleTool } from 'tessera';

// Bundler analysis:
// ✅ Includes: Viewer, RectangleTool, and their dependencies
// ❌ Excludes: TIFFParser, AnnotationStore, WebGPUBackend, etc.
// Result: Smaller bundle size
```

## Common Patterns

### Pattern 1: Pure Utility Package
```typescript
// ✅ Good: utils depends on nothing, explicit exports
// packages/utils/src/index.ts
export function clamp(value: number, min: number, max: number) { ... }
export function hexToRgb(hex: string) { ... }
```

### Pattern 2: Domain Package Using Foundation
```typescript
// ✅ Good: annotations uses geometry and events
// packages/annotations/src/index.ts
import { Point } from '@tessera/geometry';
import { EventEmitter } from '@tessera/events';

// Explicit exports for tree-shaking
export { AnnotationStore } from './store/store.js';
export { RTree } from './spatial/rtree.js';
```

### Pattern 3: Main Package Aggregation with Tree-Shaking
```typescript
// ✅ Good: main package re-exports using explicit named exports
// packages/core/src/index.ts (published as 'tessera')
export {
  WebGPUBackend,
  TileManager,
} from '@tessera/rendering';

export {
  AnnotationStore,
  RTree,
} from '@tessera/annotations';

// ❌ Bad: Wildcard exports
export * from '@tessera/rendering'; // DON'T USE
```

### Pattern 4: Avoiding Circular Dependencies
```typescript
// ❌ Bad: rendering importing annotations (creates cycle)
// packages/rendering/src/index.ts
import { Annotation } from '@tessera/annotations'; // NO!

// ✅ Good: annotations imports rendering (one-way flow)
// packages/annotations/src/index.ts
import { RenderBackend } from '@tessera/rendering'; // YES!

// ✅ Good: Main package can import from both (it's the aggregator)
// packages/core/src/index.ts (published as 'tessera')
export { WebGPUBackend } from '@tessera/rendering';
export { AnnotationStore } from '@tessera/annotations';
```

## Enforcement

To prevent circular dependencies:

1. **CI/CD**: Add a check that runs `pnpm why` to detect cycles
2. **Linting**: Consider using `dependency-cruiser` or similar tools
3. **Code Review**: Always check dependency direction in PRs
4. **Documentation**: Keep this document updated

## Package Naming

The main package is published as `tessera` (not `@tessera/core`) because:

- **Cleaner API**: `import { Viewer } from 'tessera'` is more intuitive than `import { Viewer } from '@tessera/core'`
- **No confusion**: The name doesn't imply there are other packages
- **Common pattern**: Similar to `react`, `lodash`, `three`, `vue` - single packages without scopes
- **Professional**: Matches modern library conventions

## Related Documentation

For detailed information on how packages flow together at runtime, see:
- **[Package Flow & Data Flow](./15-package-flow.md)** - Complete flow diagrams showing user imports, internal dependencies, runtime execution, and data flow through the system

## Migration Notes

When migrating from multi-package to single-package:

- All internal packages are marked `private: true`
- Only `tessera` is published to npm
- Users import everything from `tessera`
- Internal packages still use `workspace:*` for development
- Build process bundles everything into `tessera`

