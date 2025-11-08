# Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│         (React/Vue/Angular/Vanilla - User's Choice)         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tessera Core API                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Viewer   │  │ Annotations│ │  Tools   │  │  Events  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Color   │  │  Units   │  │ Calibrate│  │  Graph   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Rendering   │  │  Annotation  │  │   Drawing    │
│   Engine     │  │    System    │  │    Tools     │
└──────────────┘  └──────────────┘  └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌───────────────────────────────────┐
        │      Backend Abstraction Layer     │
        │  ┌──────┐ ┌──────┐ ┌──────┐      │
        │  │WebGPU│ │WebGL2│ │Canvas│      │
        │  └──────┘ └──────┘ └──────┘      │
        └───────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Browser     │
                    │    APIs       │
                    └──────────────┘
```

## Core Components

### 1. Viewer Core
**Purpose**: Main entry point, orchestrates all subsystems

**Responsibilities**:
- Initialize rendering backend (WebGPU → WebGL → Canvas2D)
- Manage viewport state (zoom, pan, rotation)
- Coordinate tile loading and caching
- Handle user input (pointer, keyboard, touch)
- Emit events for application integration

**Key Interfaces**:
```typescript
interface Viewer {
  canvas: HTMLCanvasElement;
  state: ViewerState;
  viewport: Viewport;
  tiles: TileManager;
  annotations: AnnotationSystem;
  tools: ToolSystem;
  events: EventEmitter;
  units: UnitRegistry;
  calibration: CalibrationSystem;
}
```

### 2. Rendering Engine
**Purpose**: Abstract rendering across multiple backends

**Responsibilities**:
- Backend detection and initialization
- Tile rendering (pyramid levels)
- Annotation rendering (GPU/Canvas paths)
- Color pipeline (linear space, LUTs, profiles)
- Compositing (tiles + annotations + overlays)

**Backend Abstraction**:
```typescript
interface RenderBackend {
  init(canvas: HTMLCanvasElement): Promise<void>;
  renderTiles(tiles: Tile[], view: ViewUniforms): void;
  renderAnnotations(batch: AnnotationBatch, view: ViewUniforms): void;
  renderOverlays(overlays: Overlay[], view: ViewUniforms): void;
  clear(): void;
}
```

### 3. Annotation System
**Purpose**: Plugin-based annotation management

**Responsibilities**:
- Annotation storage (immutable geometry)
- Type registration (plugins)
- Spatial indexing (R-tree)
- Hit-testing
- Measurement computation
- Import/export

**Key Interfaces**:
```typescript
interface AnnotationSystem {
  registerType(config: AnnotationTypeConfig): void;
  add(annotation: Annotation): void;
  update(id: string, patch: Partial<Annotation>): void;
  delete(id: string): void;
  query(bbox: BBox): Annotation[];
  hitTest(point: Point, tolerance: number): Hit[];
  measure(id: string): MeasurementResult;
}
```

### 4. Tool System
**Purpose**: Interactive drawing and editing

**Responsibilities**:
- Tool registration
- Pointer/keyboard event handling
- Drawing state machines
- Live preview rendering
- Transaction management (undo/redo)
- Constraint application (snap, grid, etc.)

**Key Interfaces**:
```typescript
interface ToolSystem {
  register(tool: Tool): void;
  activate(toolId: string): void;
  configure(toolId: string, options: ToolOptions): void;
  run(toolId: string, params: ToolParams): void;
  feed(toolId: string, event: ToolEvent): void;
}
```

### 5. Color Management
**Purpose**: Accurate color rendering

**Responsibilities**:
- Color space conversions
- LUT application (VOI, GSDF)
- ICC profile handling
- Linear working space enforcement
- Strict mode validation

**Key Interfaces**:
```typescript
interface ColorSystem {
  setSourceProfile(profile: ICCProfile): void;
  setDisplayProfile(profile: ICCProfile): void;
  applyVOILUT(lut: VOILUT): void;
  applyGSDF(enabled: boolean): void;
  setStrictMode(enabled: boolean): void;
  convert(color: Color, from: ColorSpace, to: ColorSpace): Color;
}
```

### 6. Units & Calibration
**Purpose**: Unit-aware measurements and calibration

**Responsibilities**:
- Unit registry (µm, mm, px, etc.)
- Pixel spacing management
- Measurement context (unit preferences)
- Calibration tools (spatial, grayscale, color)
- Scale bar generation

**Key Interfaces**:
```typescript
interface UnitRegistry {
  register(unit: UnitDef): void;
  convert(value: number, from: string, to: string): number;
  format(value: number, unit: string, ctx: MeasurementContext): string;
}

interface CalibrationSystem {
  spatial: SpatialCalibration;
  grayscale: GrayscaleCalibration;
  color: ColorCalibration;
  setPolicy(policy: CalibrationPolicy): void;
}
```

### 7. Event System
**Purpose**: Application integration and extensibility

**Responsibilities**:
- Event emission (annotations, tools, rendering)
- Event subscription
- Transaction logging
- Audit trail

**Key Events**:
- `tile:loaded`, `tile:error`
- `annotation:create`, `annotation:update`, `annotation:delete`
- `tool:begin`, `tool:update`, `tool:commit`, `tool:cancel`
- `calibration:commit`, `calibration:fail`
- `measurement:computed`

## Data Flow

### Rendering Pipeline
1. **Viewport Update**: User pans/zooms → view matrix changes
2. **Tile Selection**: Determine visible tiles at appropriate pyramid level
3. **Tile Loading**: Fetch missing tiles from cache or network
4. **Tile Rendering**: Draw tiles to framebuffer (GPU or Canvas)
5. **Annotation Batching**: Query visible annotations, batch by type/style
6. **Annotation Rendering**: Draw annotations on top of tiles
7. **Overlay Rendering**: Draw UI overlays (handles, previews, etc.)
8. **Compositing**: Blend all layers with proper color space
9. **Present**: Display final result

### Annotation Creation Flow
1. **Tool Activation**: User selects tool → tool becomes active
2. **Pointer Down**: Tool receives pointer event → begins transaction
3. **Pointer Move**: Tool updates geometry → emits preview
4. **Pointer Up**: Tool finalizes geometry → commits transaction
5. **Transaction Commit**: Annotation added to store
6. **Spatial Index Update**: R-tree updated for hit-testing
7. **Event Emission**: `annotation:create` event fired
8. **Rendering**: Annotation appears in next render cycle

### Measurement Flow
1. **Request**: Application requests measurement for annotation
2. **Context Resolution**: Determine measurement context (units, spacing)
3. **Measurer Selection**: Find appropriate measurer for annotation type
4. **Computation**: Measurer computes values (px and physical units)
5. **Unit Conversion**: Convert to preferred units
6. **Formatting**: Format numbers with appropriate precision
7. **Return**: Return measurement result with both px and physical values

## State Management

### Immutable Geometry
- All annotation geometry is immutable
- Updates create new objects (structural sharing where possible)
- Enables time-travel debugging and undo/redo

### Transaction Log
- Every change is a transaction
- Transactions include: `{ txId, userId, timestamp, op, before, after }`
- Enables audit trail and collaborative sync

### Viewport State
- Current zoom level, pan offset, rotation
- View matrix (image → screen transform)
- DPI/device pixel ratio
- Viewport bounds

## Plugin Architecture

### Plugin Types
1. **Annotation Types**: Custom shapes/annotations
2. **Renderers**: Custom rendering logic
3. **Tools**: Drawing/editing tools
4. **Measurers**: Measurement algorithms
5. **Importers/Exporters**: File format support
6. **Calibrators**: Calibration algorithms

### Plugin Lifecycle
1. **Registration**: Plugin registers with system
2. **Validation**: Schema validation, capability checks
3. **Initialization**: Plugin-specific setup
4. **Runtime**: Plugin handles events/rendering
5. **Cleanup**: Unregister and cleanup resources

## Performance Considerations

### Rendering Optimizations
- **Batching**: Group annotations by type/style to minimize state changes
- **Instancing**: Use instanced rendering for repeated shapes
- **Culling**: Only render visible annotations (viewport culling)
- **LOD**: Level-of-detail for complex shapes at low zoom

### Memory Management
- **Tile Cache**: LRU cache with memory limits
- **Atlas Management**: Reuse texture atlases for fonts/patterns
- **Geometry Pooling**: Reuse geometry buffers where possible
- **Worker Offloading**: Move heavy computation to workers

### Computation Optimizations
- **Spatial Index**: R-tree for O(log n) hit-testing
- **Worker Threads**: FFT, RANSAC, boolean ops in workers
- **Caching**: Cache shaped text, computed measurements
- **Lazy Evaluation**: Compute measurements on-demand

