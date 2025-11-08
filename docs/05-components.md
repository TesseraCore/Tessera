# Components

## UI Components (Application-Level)

**Note**: Tessera is a framework-agnostic library. These components would be built by the application using the library, but we document the expected UI patterns.

### 1. Viewer Component
**Purpose**: Main canvas container

**Props**:
- `canvas`: HTMLCanvasElement (or create internally)
- `source`: Image source (TIFF, Zarr, DICOM, IIIF)
- `options`: Viewer configuration

**Features**:
- Canvas element management
- Resize handling
- Fullscreen support
- Context menu (optional)

### 2. Toolbar Component
**Purpose**: Tool selection and controls

**Tools**:
- Selection tool
- Drawing tools (rectangle, ellipse, polygon, etc.)
- Text tool
- Measurement tools
- Editing tools

**Features**:
- Tool activation
- Tool groups/categories
- Keyboard shortcuts display
- Tool hints

### 3. Annotation List Component
**Purpose**: List and manage annotations

**Features**:
- List all annotations
- Filter by type
- Search annotations
- Select annotation (highlight on canvas)
- Delete annotation
- Edit annotation properties
- Group/ungroup annotations

### 4. Properties Panel Component
**Purpose**: Edit selected annotation properties

**Properties**:
- Geometry (coordinates, dimensions)
- Style (stroke, fill, line width, etc.)
- Metadata (labels, tags, notes)
- Measurements (if applicable)

### 5. Measurement Panel Component
**Purpose**: Display measurements

**Features**:
- List measurements for selected annotation
- Unit selection (µm, mm, px, etc.)
- Export measurements
- Measurement history

### 6. Calibration Panel Component
**Purpose**: Run calibration tools

**Tools**:
- Spatial calibration (ruler/grid detection)
- Grayscale calibration (VOI LUT verification)
- Color calibration (ColorChecker verification)

**Features**:
- ROI selection for calibration
- Calibration results display
- Error reporting
- Profile management

### 7. Layer Panel Component
**Purpose**: Manage image layers and overlays

**Features**:
- List layers
- Show/hide layers
- Reorder layers
- Blend modes
- Opacity controls

### 8. Viewport Controls Component
**Purpose**: Navigation and view controls

**Controls**:
- Zoom in/out buttons
- Fit to view
- Reset view
- Zoom level indicator
- Pan controls (arrows)
- Rotation controls (if enabled)

### 9. Scale Bar Component
**Purpose**: Display scale bar overlay

**Features**:
- Dynamic scale bar
- Unit display (µm, mm, etc.)
- Position (configurable)
- Style (color, size)

### 10. Status Bar Component
**Purpose**: Display status information

**Information**:
- Current zoom level
- Image dimensions
- Pixel spacing
- Cursor position (image coords)
- Selected tool
- Loading status

## Core Library Components (Internal)

### 1. RenderBackend
**Purpose**: Abstract rendering interface

**Implementations**:
- `WebGPUBackend`
- `WebGL2Backend`
- `WebGLBackend`
- `Canvas2DBackend`

**Methods**:
- `init(canvas)`: Initialize backend
- `renderTiles(tiles, view)`: Render image tiles
- `renderAnnotations(batch, view)`: Render annotations
- `renderOverlays(overlays, view)`: Render UI overlays
- `clear()`: Clear canvas

### 2. TileManager
**Purpose**: Manage tile loading and caching

**Responsibilities**:
- Tile source abstraction
- LRU cache management
- Request queue management
- Error handling and retries
- Memory management

**Methods**:
- `getTile(level, x, y)`: Get tile (from cache or load)
- `prefetchTiles(viewport)`: Prefetch visible tiles
- `clearCache()`: Clear tile cache
- `setCacheSize(size)`: Set cache size limit

### 3. Viewport
**Purpose**: Manage viewport state and transforms

**State**:
- Zoom level
- Pan offset (x, y)
- Rotation angle
- Viewport bounds
- Device pixel ratio

**Methods**:
- `setZoom(level)`: Set zoom level
- `setPan(x, y)`: Set pan offset
- `setRotation(angle)`: Set rotation
- `screenToImage(x, y)`: Convert screen to image coords
- `imageToScreen(x, y)`: Convert image to screen coords
- `getViewMatrix()`: Get current view matrix

### 4. AnnotationStore
**Purpose**: Store and manage annotations

**Storage**:
- Immutable annotation objects
- Transaction log
- Spatial index (R-tree)

**Methods**:
- `add(annotation)`: Add annotation
- `update(id, patch)`: Update annotation
- `delete(id)`: Delete annotation
- `get(id)`: Get annotation by ID
- `query(bbox)`: Query annotations in bounding box
- `hitTest(point, tolerance)`: Hit test at point

### 5. SpatialIndex
**Purpose**: Fast spatial queries (R-tree)

**Methods**:
- `insert(annotation)`: Insert annotation
- `remove(id)`: Remove annotation
- `update(id, bbox)`: Update annotation bounds
- `query(bbox)`: Query annotations in bounding box
- `nearest(point, k)`: Find k nearest annotations

### 6. ToolStateMachine
**Purpose**: Manage tool state transitions

**States**:
- `idle`: No active tool
- `preview`: Showing preview
- `drawing`: Actively drawing
- `editing`: Editing existing annotation

**Transitions**:
- `pointerDown` → `drawing`
- `pointerMove` → `preview` or `drawing`
- `pointerUp` → `idle` or `editing`
- `cancel` → `idle`

### 7. TransactionManager
**Purpose**: Manage undo/redo and transactions

**Features**:
- Transaction log
- Undo/redo stack
- Transaction batching
- Audit trail

**Methods**:
- `begin()`: Start transaction
- `commit()`: Commit transaction
- `cancel()`: Cancel transaction
- `undo()`: Undo last transaction
- `redo()`: Redo last undone transaction
- `getHistory()`: Get transaction history

### 8. ColorPipeline
**Purpose**: Manage color transformations

**Pipeline**:
1. Source color space → Linear RGB
2. Apply VOI LUT (if grayscale)
3. Apply GSDF (if enabled)
4. Apply display profile
5. Convert to sRGB for display

**Methods**:
- `setSourceProfile(profile)`: Set source color profile
- `setDisplayProfile(profile)`: Set display profile
- `applyVOILUT(lut)`: Apply VOI LUT
- `applyGSDF(enabled)`: Enable/disable GSDF
- `transform(color, from, to)`: Transform color

### 9. UnitRegistry
**Purpose**: Manage unit definitions and conversions

**Methods**:
- `register(unit)`: Register unit definition
- `convert(value, from, to)`: Convert between units
- `format(value, unit, context)`: Format value with unit
- `getUnit(id)`: Get unit definition

### 10. CalibrationSystem
**Purpose**: Run calibration tools

**Subsystems**:
- `spatial`: Spatial calibration (pixel spacing)
- `grayscale`: Grayscale calibration (VOI LUT)
- `color`: Color calibration (ΔE verification)

**Methods**:
- `spatial.run(options)`: Run spatial calibration
- `grayscale.verify(options)`: Verify grayscale
- `color.verify(options)`: Verify color
- `setPolicy(policy)`: Set calibration policy

### 11. TextShaping
**Purpose**: Text shaping and layout

**Features**:
- HarfBuzz integration (WASM)
- Complex script support
- Bidi text support
- Emoji support
- Ligature support

**Methods**:
- `shape(text, font, features)`: Shape text
- `layout(text, width, options)`: Layout text with wrapping
- `measure(text, font)`: Measure text dimensions

### 12. GlyphAtlas
**Purpose**: Manage glyph texture atlas

**Features**:
- MSDF/SDF generation
- Atlas packing
- Mipmap generation
- Emoji atlas (separate)

**Methods**:
- `getGlyph(char, font, size)`: Get glyph from atlas
- `uploadGlyph(glyph)`: Upload glyph to atlas
- `clear()`: Clear atlas

### 13. EventEmitter
**Purpose**: Event system

**Methods**:
- `on(event, handler)`: Subscribe to event
- `off(event, handler)`: Unsubscribe from event
- `emit(event, data)`: Emit event
- `once(event, handler)`: Subscribe once

### 14. GraphSystem
**Purpose**: Overlay graph (clipping, masking)

**Node Types**:
- `Clip`: Clip target to sources
- `Mask`: Mask target with sources
- `Overlay`: Composite overlay

**Methods**:
- `add(node)`: Add graph node
- `remove(id)`: Remove graph node
- `update(id, patch)`: Update graph node
- `resolve(target)`: Resolve graph for target

## Component Interaction

### Rendering Flow
```
Viewer → Viewport → TileManager → RenderBackend
                ↓
         AnnotationStore → SpatialIndex
                ↓
         RenderBackend (annotations)
                ↓
         RenderBackend (overlays)
```

### Tool Flow
```
User Input → ToolStateMachine → Active Tool
                ↓
         Tool → TransactionManager → AnnotationStore
                ↓
         EventEmitter → Application
```

### Measurement Flow
```
AnnotationStore → Measurer → UnitRegistry → Format
```

## Component Lifecycle

### Initialization
1. Create canvas element
2. Initialize RenderBackend (detect capabilities)
3. Initialize Viewport
4. Initialize TileManager
5. Initialize AnnotationStore
6. Initialize ToolSystem
7. Initialize EventEmitter
8. Set up event listeners

### Runtime
1. User interaction → ToolSystem
2. ToolSystem → AnnotationStore (via TransactionManager)
3. AnnotationStore → SpatialIndex (update)
4. AnnotationStore → EventEmitter (emit events)
5. Viewport change → TileManager (load tiles)
6. Render cycle → RenderBackend (render everything)

### Cleanup
1. Remove event listeners
2. Clear caches (tiles, atlases)
3. Release GPU resources
4. Cancel pending requests
5. Clear workers

