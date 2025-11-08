# Modules

## Module Breakdown

### Core Modules

#### 1. `@tessera/core`
**Purpose**: Main entry point and viewer orchestration

**Exports**:
- `createViewer()`: Factory function to create viewer instance
- `Viewer`: Main viewer class
- `ViewerState`: State management
- `Viewport`: Viewport management

**Dependencies**: All other modules

#### 2. `@tessera/rendering`
**Purpose**: Rendering engine and backend abstraction

**Submodules**:
- `backend/`: Backend implementations (WebGPU, WebGL2, WebGL, Canvas2D)
- `tiles/`: Tile loading and caching
- `shaders/`: Shader code for GPU backends
- `color/`: Color pipeline and LUTs

**Exports**:
- `RenderBackend`: Backend interface
- `TileManager`: Tile loading/caching
- `ColorPipeline`: Color management
- Backend factories

**Dependencies**: None (low-level)

#### 3. `@tessera/annotations`
**Purpose**: Annotation system and plugin architecture

**Submodules**:
- `store/`: Annotation storage (immutable)
- `spatial/`: Spatial indexing (R-tree)
- `types/`: Built-in annotation types
- `plugins/`: Plugin registration system

**Exports**:
- `AnnotationSystem`: Main annotation manager
- `Annotation`: Base annotation interface
- `AnnotationType`: Type registration
- Built-in types (Point, Line, Polygon, Rectangle, Ellipse, Text, etc.)

**Dependencies**: `@tessera/rendering`, `@tessera/geometry`

#### 4. `@tessera/tools`
**Purpose**: Drawing and editing tools

**Submodules**:
- `drawing/`: Drawing tools (rectangle, ellipse, polygon, etc.)
- `editing/`: Editing tools (vertex manipulation, boolean ops)
- `selection/`: Selection tools
- `state/`: Tool state machines

**Exports**:
- `ToolSystem`: Tool management
- `Tool`: Tool interface
- Built-in tools (RectangleTool, PolygonTool, FreehandTool, etc.)

**Dependencies**: `@tessera/annotations`, `@tessera/events`

#### 5. `@tessera/geometry`
**Purpose**: 2D geometry operations

**Submodules**:
- `primitives/`: Basic shapes (Point, Line, Polygon, etc.)
- `transforms/`: Transformations (rotate, scale, translate)
- `boolean/`: Boolean operations (union, intersect, difference)
- `simplify/`: Path simplification (Douglas-Peucker)
- `smooth/`: Curve smoothing (Chaikin)

**Exports**:
- Geometry primitives
- Transform functions
- Boolean operation functions
- Utility functions (distance, area, etc.)

**Dependencies**: None (pure math)

#### 6. `@tessera/units`
**Purpose**: Unit system and calibration

**Submodules**:
- `registry/`: Unit registry
- `calibration/`: Calibration tools (spatial, grayscale, color)
- `measurement/`: Measurement context and computation

**Exports**:
- `UnitRegistry`: Unit management
- `CalibrationSystem`: Calibration tools
- `MeasurementContext`: Measurement configuration
- Unit definitions (µm, mm, px, in, etc.)

**Dependencies**: `@tessera/geometry` (for calibration)

#### 7. `@tessera/text`
**Purpose**: Text rendering and editing

**Submodules**:
- `shaping/`: Text shaping (HarfBuzz integration)
- `atlas/`: Glyph atlas management
- `layout/`: Text layout (line wrapping, alignment)
- `editing/`: Text editing (caret, selection)

**Exports**:
- `TextSystem`: Text management
- `TextAnnotation`: Text annotation type
- `TextTool`: Text editing tool
- Font loading utilities

**Dependencies**: `@tessera/rendering`, `@tessera/annotations`

#### 8. `@tessera/events`
**Purpose**: Event system

**Exports**:
- `EventEmitter`: Event system
- Event types and interfaces
- Transaction logging

**Dependencies**: None

#### 9. `@tessera/graph`
**Purpose**: Overlay graph system (clipping, masking, compositing)

**Submodules**:
- `nodes/`: Graph node types
- `resolvers/`: Policy resolvers
- `boolean/`: Boolean operations for overlays

**Exports**:
- `GraphSystem`: Graph management
- Node types (Clip, Mask, Overlay)
- Resolver system

**Dependencies**: `@tessera/annotations`, `@tessera/geometry`

### Utility Modules

#### 10. `@tessera/utils`
**Purpose**: Shared utilities

**Exports**:
- Math utilities
- Color utilities
- Array/object utilities
- Type guards

**Dependencies**: None

#### 11. `@tessera/workers`
**Purpose**: Web Worker utilities

**Exports**:
- Worker pool management
- Worker message protocols
- Heavy computation workers (FFT, RANSAC, boolean ops)

**Dependencies**: `@tessera/geometry`

### Format Support Modules

#### 12. `@tessera/formats`
**Purpose**: Image format support

**Submodules**:
- `tiff/`: TIFF/OME-TIFF support
- `zarr/`: Zarr array support
- `dicom/`: DICOM support
- `iiif/`: IIIF Image API support

**Exports**:
- Format parsers
- Tile source interfaces
- Metadata extractors

**Dependencies**: `@tessera/rendering`

### Import/Export Modules

#### 13. `@tessera/import`
**Purpose**: Import annotations from external formats

**Exports**:
- GeoJSON importer
- WKT importer
- DICOM SR importer
- Custom importers

**Dependencies**: `@tessera/annotations`

#### 14. `@tessera/export`
**Purpose**: Export annotations to external formats

**Exports**:
- GeoJSON exporter
- WKT exporter
- SVG exporter
- PDF exporter
- DICOM SR exporter

**Dependencies**: `@tessera/annotations`, `@tessera/rendering`

## Module Dependencies Graph

```
@tessera/core
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
├── @tessera/graph
│   ├── @tessera/annotations
│   └── @tessera/geometry
└── @tessera/events

@tessera/formats
└── @tessera/rendering

@tessera/import
└── @tessera/annotations

@tessera/export
├── @tessera/annotations
└── @tessera/rendering

@tessera/workers
└── @tessera/geometry
```

## Module Size Estimates

### Core Bundle (Minimal)
- `@tessera/core`: ~50KB
- `@tessera/rendering`: ~100KB
- `@tessera/annotations`: ~80KB
- `@tessera/tools`: ~60KB
- `@tessera/geometry`: ~40KB
- `@tessera/events`: ~10KB
- **Total**: ~340KB (minified, gzipped: ~100KB)

### Full Bundle (All Features)
- Core bundle: ~340KB
- `@tessera/units`: ~50KB
- `@tessera/text`: ~120KB (includes HarfBuzz WASM)
- `@tessera/graph`: ~40KB
- `@tessera/formats`: ~80KB
- `@tessera/import`: ~30KB
- `@tessera/export`: ~60KB
- **Total**: ~720KB (minified, gzipped: ~200KB)

### Optional Add-ons
- Workers: ~50KB (WASM modules)
- Advanced calibration: ~80KB (FFT, RANSAC WASM)
- Boolean operations: ~40KB (clipper WASM)

## Module Loading Strategy

### ESM (Recommended)
```typescript
import { createViewer } from '@tessera/core';
import { RectangleTool } from '@tessera/tools';
import { TIFFSource } from '@tessera/formats';
```

### Tree Shaking
- All modules support tree shaking
- Import only what you need
- Unused code eliminated by bundler

### Code Splitting
- Core modules: Load immediately
- Format support: Load on-demand
- Workers: Load when needed
- Calibration tools: Load when calibration panel opens

## Module Versioning

### Version Strategy
- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### Compatibility
- Modules within same major version are compatible
- Cross-major version may require migration
- Deprecation warnings before breaking changes

