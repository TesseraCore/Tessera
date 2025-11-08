# Package Flow & Data Flow

## Overview

This document explains how packages flow together in Tessera, from user imports through internal package dependencies to runtime execution.

## User → Package Flow

### Import Flow

```
User Application
    │
    │ import { Viewer, RectangleTool, TIFFParser } from 'tessera'
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    tessera (PUBLISHED)                      │
│              packages/core/src/index.ts                     │
│                                                             │
│  Re-exports everything using explicit named exports:        │
│  • export { Viewer } from './viewer.js'                     │
│  • export { WebGPUBackend } from '@tessera/rendering'       │
│  • export { AnnotationStore } from '@tessera/annotations'   │
│  • export { RectangleTool } from '@tessera/tools'           │
│  • export { TIFFParser } from '@tessera/formats'            │
│  • ... (all other exports)                                  │
└─────────────────────────────────────────────────────────────┘
    │
    │ Tree-shaking: Only imports what user actually uses
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              User's Bundled Application                     │
│  Contains only: Viewer, RectangleTool, TIFFParser           │
│  Excludes: AnnotationStore, WebGPUBackend, etc.             │
│  (if not imported)                                          │
└─────────────────────────────────────────────────────────────┘
```

## Internal Package Flow

### Dependency Flow (Bottom-Up)

```
Layer 0: Foundation (no dependencies)
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    utils     │  │    events    │  │   geometry   │
│  (pure)      │  │   (pure)     │  │   (pure)     │
└──────────────┘  └──────────────┘  └──────────────┘
       │                │                 │
       │                │                 │
       └────────────────┼─────────────────┘
                        │
                        ▼
Layer 1: Core Infrastructure
┌──────────────┐  ┌──────────────┐
│  rendering   │  │    units     │
│  → utils     │  │  → geometry  │
└──────────────┘  └──────────────┘
       │                │
       │                │
       └────────────────┼──────────────┐
                        │              │
                        ▼              ▼
Layer 2: Domain Logic
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ annotations  │  │    tools     │  │     text     │  │    graph     │
│ → rendering  │  │ → annotations│  │ → rendering  │  │ → annotations│
│ → geometry   │  │ → geometry   │  │ → annotations│  │ → geometry   │
│ → events     │  │ → events     │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
       │                │
       │                │
       └────────────────┼──────────────┐
                        │              │
                        ▼              ▼
Layer 3: Format & I/O
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   formats    │  │    import    │  │    export    │  │   workers    │
│ → rendering  │  │ → annotations│  │ → annotations│  │ → geometry   │
│              │  │              │  │ → rendering  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                        │
                        │
                        ▼
Layer 4: Public API
┌─────────────────────────────────────────────────────────────┐
│                    tessera                                  │
│              (packages/core)                                │
│                                                             │
│  Aggregates ALL packages from ALL layers                    │
│  • Imports from Layer 0: utils, events, geometry            │
│  • Imports from Layer 1: rendering, units                   │
│  • Imports from Layer 2: annotations, tools, text, graph    │
│  • Imports from Layer 3: formats, import, export, workers   │
│                                                             │
│  Re-exports everything with explicit named exports          │
└─────────────────────────────────────────────────────────────┘
```

## Runtime Data Flow

### Viewer Initialization Flow

```
User Code:
  const viewer = new Viewer({ canvas, imageUrl });

┌─────────────────────────────────────────────────────────────┐
│                    tessera (Viewer)                         │
│                                                             │
│  1. Initialize Viewport                                     │
│     └─> packages/core/src/viewport.ts                       │
│                                                             │
│  2. Initialize Rendering Backend                            │
│     └─> @tessera/rendering                                  │
│         ├─> Detect WebGPU/WebGL2/WebGL/Canvas2D             │
│         ├─> Initialize backend                              │
│         └─> Uses @tessera/utils (math, color)               │
│                                                             │
│  3. Initialize Tile Manager                                 │
│     └─> @tessera/rendering/tiles/manager.ts                 │
│         └─> Uses @tessera/rendering                         │
│                                                             │
│  4. Initialize Annotation Store                             │
│     └─> @tessera/annotations                                │
│         ├─> Uses @tessera/rendering (for display)           │
│         ├─> Uses @tessera/geometry (spatial ops)            │
│         └─> Uses @tessera/events (change notifications)     │
│                                                             │
│  5. Initialize Tool System                                  │
│     └─> @tessera/tools                                      │
│         ├─> Uses @tessera/annotations (create/modify)       │
│         ├─> Uses @tessera/geometry (operations)             │
│         └─> Uses @tessera/events (emit events)              │
│                                                             │
│  6. Initialize Format Parser                                │
│     └─> @tessera/formats                                    │
│         └─> Uses @tessera/rendering (tile sources)          │
└─────────────────────────────────────────────────────────────┘
```

### Rendering Flow

```
Viewport Change (pan/zoom)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                    tessera (Viewer)                          │
│                                                              │
│  1. Update Viewport                                          │
│     └─> packages/core/src/viewport.ts                        │
│         • Calculate view matrix                              │
│         • Determine visible region                           │
│                                                              │
│  2. Load Tiles                                               │
│     └─> @tessera/rendering/tiles/manager.ts                  │
│         ├─> Query tile cache (@tessera/rendering/tiles/cache)│
│         ├─> Request missing tiles from @tessera/formats      │
│         └─> Uses @tessera/utils (utilities)                  │
│                                                              │
│  3. Query Annotations                                        │
│     └─> @tessera/annotations                                 │
│         ├─> Spatial query (@tessera/annotations/spatial)     │
│         │   └─> Uses @tessera/geometry (R-tree)              │
│         └─> Filter visible annotations                       │
│                                                              │
│  4. Render                                                   │
│     └─> @tessera/rendering                                   │
│         ├─> Render tiles (WebGPU/WebGL2/WebGL/Canvas2D)      │
│         ├─> Render annotations                               │
│         │   └─> Uses @tessera/geometry (transformations)     │
│         └─> Render overlays (tools, previews)                │
│                                                              │
│  5. Emit Events                                              │
│     └─> @tessera/events                                      │
│         • tile:loaded, tile:error                            │
│         • viewport:changed                                   │
└──────────────────────────────────────────────────────────────┘
```

### Annotation Creation Flow

```
User Interaction (click/drag)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    tessera (Viewer)                         │
│                                                             │
│  1. Tool Receives Input                                     │
│     └─> @tessera/tools                                      │
│         ├─> Active tool (e.g., RectangleTool)               │
│         └─> Uses @tessera/events (emit tool:begin)          │
│                                                             │
│  2. Tool Processes Input                                    │
│     └─> @tessera/tools/drawing/rectangle.ts                 │
│         ├─> Calculate geometry                              │
│         │   └─> Uses @tessera/geometry (Point, Rectangle)   │
│         └─> Emit preview                                    │
│             └─> Uses @tessera/events (tool:update)          │
│                                                             │
│  3. Tool Commits                                            │
│     └─> @tessera/tools                                      │
│         ├─> Create annotation                               │
│         │   └─> Uses @tessera/annotations/types             │
│         └─> Add to store                                    │
│             └─> @tessera/annotations/store/store.ts         │
│                 ├─> Add annotation                          │
│                 ├─> Update spatial index                    │
│                 │   └─> @tessera/annotations/spatial/rtree  │
│                 │       └─> Uses @tessera/geometry          │
│                 └─> Emit event                              │
│                     └─> @tessera/events (annotation:create) │
│                                                             │
│  4. Re-render                                               │
│     └─> @tessera/rendering                                  │
│         └─> Render new annotation                           │
└─────────────────────────────────────────────────────────────┘
```

### Format Loading Flow

```
User Code:
  const parser = new TIFFParser();
  const tiles = await parser.load(imageUrl);

┌─────────────────────────────────────────────────────────────┐
│                    tessera (User Import)                    │
│                                                             │
│  import { TIFFParser } from 'tessera'                       │
│    │                                                        │
│    └─> Re-exported from @tessera/formats                    │
│                                                             │
│  @tessera/formats/tiff/parser.ts                            │
│    │                                                        │
│    ├─> Parse TIFF file                                      │
│    ├─> Extract metadata                                     │
│    └─> Create TileSource                                    │
│        └─> @tessera/rendering/tiles/source.ts               │
│            └─> Implements TileSource interface              │
│                                                             │
│  TileSource used by:                                        │
│    └─> @tessera/rendering/tiles/manager.ts                  │
│        └─> Loads tiles for rendering                        │
└─────────────────────────────────────────────────────────────┘
```

## Import/Export Flow

### Import Flow

```
User Code:
  import { importGeoJSON } from 'tessera';
  const annotations = importGeoJSON(geojsonData);

┌─────────────────────────────────────────────────────────────┐
│                    tessera                                  │
│                                                             │
│  Re-exports:                                                │
│    export { importGeoJSON } from '@tessera/import'          │
│                                                             │
│  @tessera/import/geojson.ts                                 │
│    │                                                        │
│    ├─> Parse GeoJSON                                        │
│    ├─> Convert to annotations                               │
│    │   └─> Uses @tessera/annotations/types                  │
│    │       └─> Uses @tessera/geometry (Point, Polygon)      │
│    └─> Return annotations                                   │
│                                                             │
│  User adds annotations:                                     │
│    viewer.annotations.add(annotations)                      │
│      └─> @tessera/annotations/store/store.ts                │
└─────────────────────────────────────────────────────────────┘
```

### Export Flow

```
User Code:
  import { exportSVG } from 'tessera';
  const svg = exportSVG(annotations, viewer);

┌─────────────────────────────────────────────────────────────┐
│                    tessera                                  │
│                                                             │
│  Re-exports:                                                │
│    export { exportSVG } from '@tessera/export'              │
│                                                             │
│  @tessera/export/svg.ts                                     │
│    │                                                        │
│    ├─> Read annotations                                     │
│    │   └─> Uses @tessera/annotations                        │
│    ├─> Convert to SVG                                       │
│    │   └─> Uses @tessera/geometry (transformations)         │
│    └─> Optionally render visual                             │
│        └─> Uses @tessera/rendering (for visual export)      │
│                                                             │
│  Returns SVG string                                         │
└─────────────────────────────────────────────────────────────┘
```

## Worker Flow

```
User Code:
  import { BooleanWorker } from 'tessera';
  const worker = new BooleanWorker();
  const result = await worker.union(polygon1, polygon2);

┌─────────────────────────────────────────────────────────────┐
│                    tessera                                  │
│                                                             │
│  Re-exports:                                                │
│    export { BooleanWorker } from '@tessera/workers'         │
│                                                             │
│  @tessera/workers/boolean.ts                                │
│    │                                                        │
│    ├─> Create Web Worker                                    │
│    ├─> Send geometry data                                   │
│    │   └─> Uses @tessera/geometry (Polygon types)           │
│    ├─> Perform boolean operation in worker                  │
│    │   └─> Uses @tessera/geometry/boolean/*                 │
│    └─> Return result                                        │
│        └─> Uses @tessera/geometry (Polygon)                 │
│                                                             │
│  Benefits:                                                  │
│    • Offloads heavy computation                             │
│    • Keeps main thread responsive                           │
│    • Geometry operations isolated                           │
└─────────────────────────────────────────────────────────────┘
```

## Complete Flow Example

### Example: Loading and Annotating an Image

```typescript
// User code
import { Viewer, TIFFParser, RectangleTool } from 'tessera';

// 1. Create viewer
const viewer = new Viewer({ canvas, imageUrl: 'image.tiff' });
//    └─> Initializes: Viewport, Rendering, Tiles, Annotations, Tools

// 2. Load format parser
const parser = new TIFFParser();
//    └─> @tessera/formats → @tessera/rendering (TileSource)

// 3. Activate tool
viewer.tools.activate('rectangle');
//    └─> @tessera/tools → @tessera/annotations, @tessera/geometry, @tessera/events

// 4. User draws rectangle
//    └─> @tessera/tools → creates annotation → @tessera/annotations
//        └─> Uses @tessera/geometry (Rectangle type)
//        └─> Uses @tessera/events (emit events)

// 5. Annotation rendered
//    └─> @tessera/rendering → renders annotation
//        └─> Uses @tessera/annotations (get annotations)
//        └─> Uses @tessera/geometry (transformations)
```

## Key Principles

### 1. Unidirectional Flow
- Dependencies flow **downward** only (Layer 4 → Layer 0)
- Never upward or sideways
- Prevents circular dependencies

### 2. Single Aggregation Point
- Only `tessera` imports from multiple packages
- All other packages have focused dependencies
- Clear separation of concerns

### 3. Tree-Shaking Friendly
- Explicit named exports at every level
- Users only bundle what they import
- Internal structure transparent to bundlers

### 4. Runtime Efficiency
- Packages only loaded when used
- Workers offload heavy computation
- Efficient dependency resolution

## Visual Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         │
│         import { Viewer, Tool, Parser } from 'tessera'      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    tessera (PUBLISHED)                      │
│              Single Entry Point                             │
│              Re-exports everything                          │
└─────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│rendering │    │annotations│    │  tools   │    │ formats  │
│  Layer 1 │    │  Layer 2  │    │ Layer 2  │    │ Layer 3  │
└──────────┘    └───────────┘    └──────────┘    └──────────┘
    │                │              │              │
    ▼                ▼              ▼              ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  utils   │    │ geometry │    │  events  │    │  ...     │
│ Layer 0  │    │ Layer 0  │    │ Layer 0  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

This architecture ensures:
- ✅ No circular dependencies
- ✅ Optimal tree-shaking
- ✅ Clear separation of concerns
- ✅ Easy to understand and maintain
- ✅ Professional, modern design

