# Annotation System

## Overview

The annotation system is plugin-based, allowing developers to register custom annotation types with their own rendering, hit-testing, and measurement logic. All annotations are stored in image-space coordinates, making them zoom-invariant.

## Core Concepts

### Image-Space Coordinates
- All annotation geometry is stored in **image pixels**
- Coordinates remain stable regardless of zoom/pan
- Conversion to screen-space happens during rendering only

### Immutable Geometry
- Annotations are immutable objects
- Updates create new objects (structural sharing where possible)
- Enables undo/redo and time-travel debugging

### Plugin Architecture
- Annotation types are registered via plugins
- Each type defines: schema, renderer, measurers, importers/exporters
- Tools are separate from annotation types (one tool can create multiple types)

## Base Annotation Interface

```typescript
interface AnnBase<TGeom, TStyle> {
  id: string;                    // Unique identifier
  type: string;                  // Annotation type (e.g., 'roi.polygon')
  zIndex: number;                // Rendering order
  space: 'image';                // Coordinate space (always 'image')
  geom: TGeom;                   // Geometry (type-specific)
  style?: TStyle;                // Styling (type-specific)
  metadata?: Record<string, any>; // Custom metadata
  pxPerMm?: number | [number, number]; // Optional pixel spacing
}
```

## Built-in Annotation Types

### 1. Point
**Type**: `'point'`

**Geometry**:
```typescript
{
  x: number;
  y: number;
}
```

**Use Cases**: Markers, landmarks, measurement points

### 2. Line / Polyline
**Type**: `'line'` or `'polyline'`

**Geometry**:
```typescript
{
  points: Array<{ x: number; y: number }>;
  closed?: boolean;  // For closed polylines
}
```

**Use Cases**: Measurements, boundaries, paths

### 3. Polygon
**Type**: `'polygon'`

**Geometry**:
```typescript
{
  rings: Array<Array<{ x: number; y: number }>>;  // Outer ring + holes
}
```

**Use Cases**: ROIs, regions of interest, masks

### 4. Rectangle
**Type**: `'rectangle'`

**Geometry**:
```typescript
{
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;  // Optional rotation in radians
}
```

**Use Cases**: Bounding boxes, regions

### 5. Ellipse / Circle
**Type**: `'ellipse'`

**Geometry**:
```typescript
{
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  theta?: number;  // Optional rotation in radians
}
```

**Use Cases**: Circular ROIs, measurements

### 6. Spline / Bezier
**Type**: `'spline'` or `'bezier'`

**Geometry**:
```typescript
{
  controlPoints: Array<{ x: number; y: number }>;
  knots?: number[];  // For NURBS
  degree?: number;   // Spline degree
}
```

**Use Cases**: Smooth curves, organic shapes

### 7. Text
**Type**: `'text'`

**Geometry**:
```typescript
{
  anchor: { x: number; y: number };
  box?: { w: number; h?: number; rotation?: number };
  content: InlineSpan[];
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  wrap?: 'none' | 'word' | 'char';
  font: {
    family: string;
    weight?: number;
    size: number;
    sizeUnit: 'px-screen' | 'px-image' | 'pt' | 'mm';
  };
}
```

**Use Cases**: Labels, notes, callouts

## Style System

### Style Properties
```typescript
interface Style {
  stroke?: string;           // Stroke color (hex/rgb)
  fill?: string | FillDef;  // Fill color or pattern
  width?: number;           // Stroke width (px or mm)
  dash?: number[];         // Dash pattern [dash, gap, ...]
  join?: 'miter' | 'round' | 'bevel';
  cap?: 'butt' | 'round' | 'square';
  opacity?: number;        // 0-1
}
```

### Fill Types
```typescript
type FillDef =
  | { kind: 'solid'; color: string }
  | { kind: 'hatch'; spacing: number; space: 'screen' | 'image'; angle?: number }
  | { kind: 'pattern'; image: string; scale?: number }
```

### Style Dictionaries
Reusable style palettes:
```typescript
viewer.styles.define('roi-default', {
  stroke: '#0af',
  fill: { kind: 'solid', color: '#0af22' },
  width: 1.5
});

// Use in annotation
annotation.style = viewer.styles.get('roi-default');
```

## Plugin Registration

### Registering an Annotation Type

```typescript
viewer.annotations.registerType({
  type: 'roi.spline',
  schema: splineSchemaJSON,  // JSON Schema for validation
  
  renderer: {
    // GPU/WebGL rendering
    draw(batch: Annotation[], io: DrawIO, view: ViewUniforms): void {
      // Batch annotations by style
      // Use instanced rendering
      // Draw via DrawIO abstraction
    },
    
    // Hit testing
    hitTest(
      pt: Point,
      view: ViewUniforms,
      index: SpatialIndex
    ): Hit[] {
      // Query spatial index
      // Test distance to shape
      // Return hits sorted by distance
    }
  },
  
  // Measurement algorithms
  measurers: [
    areaMeasurer,
    perimeterMeasurer,
    // Custom measurers
  ],
  
  // Optional import/export
  importers: {
    fromGeoJSON: (feature) => { /* ... */ },
    fromWKT: (wkt) => { /* ... */ }
  },
  
  exporters: {
    toGeoJSON: (ann) => { /* ... */ },
    toWKT: (ann) => { /* ... */ }
  }
});
```

## DrawIO Abstraction

**Purpose**: Abstract rendering across GPU and Canvas2D backends

```typescript
interface DrawIO {
  // Style management
  pushStyle(style: Style): void;
  popStyle(): void;
  
  // Primitives
  line(from: Point, to: Point, space: 'image' | 'screen'): void;
  rectangle(rect: Rect, space: 'image' | 'screen'): void;
  ellipse(ellipse: Ellipse, space: 'image' | 'screen'): void;
  polygon(polygon: Polygon, space: 'image' | 'screen'): void;
  spline(controlPoints: Point[], space: 'image' | 'screen'): void;
  
  // Drawing commands
  stroke(): void;
  fill(): void;
  
  // Handles/gizmos
  handle(pos: Point, options: HandleOptions): void;
  
  // Optional vector outline for exports
  outline?(ann: Annotation, view: ViewUniforms): Path2DLike;
}
```

## Hit Testing

### Spatial Index (R-tree)
- All annotations indexed by bounding box
- Fast O(log n) queries
- Zoom-aware tolerance (e.g., 5px in screen space)

### Hit Test Flow
1. Convert screen point to image coordinates
2. Query spatial index with tolerance
3. For each candidate, test precise distance
4. Return hits sorted by distance with part IDs

### Hit Result
```typescript
interface Hit {
  id: string;           // Annotation ID
  part?: string;        // 'edge', 'vertex', 'handle', etc.
  distPx: number;       // Distance in screen pixels
  point?: Point;        // Closest point on shape
}
```

## Measurement System

### Measurer Interface
```typescript
interface Measurer {
  id: string;
  measure(
    ann: Annotation,
    ctx: MeasurementContext
  ): MeasurementResult;
}
```

### Measurement Context
```typescript
interface MeasurementContext {
  pixelSpacing: {
    x: number;  // mm per pixel
    y: number;  // mm per pixel
    unit: 'mm' | 'µm' | 'nm';
  };
  lengthUnit: string;    // Preferred unit ('µm', 'mm', 'px')
  areaUnit: string;     // Preferred unit ('mm²', 'µm²', 'px²')
  angleUnit: string;    // Preferred unit ('deg', 'rad')
  rounding: {
    adaptive?: boolean;  // Auto-switch units
    lengthDecimals?: number;
    areaDecimals?: number;
  };
}
```

### Measurement Result
```typescript
interface MeasurementResult {
  length?: { px: number; mm: number; [unit: string]: number };
  area?: { px2: number; mm2: number; [unit: string]: number };
  angle?: { deg: number; rad: number };
  // Custom measurements
  [key: string]: any;
}
```

### Built-in Measurers
- **Area**: Computes area in px² and mm²
- **Perimeter**: Computes perimeter in px and mm
- **Angle**: Computes angle between segments
- **Feret Diameter**: Min/max Feret diameters
- **Centroid**: Center of mass
- **Bounding Box**: Bounding rectangle

## Import/Export

### Supported Formats

#### GeoJSON
```typescript
// Import
const annotations = viewer.annotations.import.fromGeoJSON(geojson);

// Export
const geojson = viewer.annotations.export.toGeoJSON(annotations);
```

#### WKT (Well-Known Text)
```typescript
// Import
const annotation = viewer.annotations.import.fromWKT(wktString);

// Export
const wkt = viewer.annotations.export.toWKT(annotation);
```

#### DICOM SR (Structured Reports)
```typescript
// Export (medical use)
const dicomSR = viewer.annotations.export.toDICOMSR(annotations, metadata);
```

#### Custom JSON
```typescript
// Lossless serialization
const json = JSON.stringify(annotation);
const restored = JSON.parse(json);
```

## Events

### Annotation Events
```typescript
// Creation
viewer.events.on('annotation:create', (e) => {
  console.log('Created:', e.annotation);
});

// Update
viewer.events.on('annotation:update', (e) => {
  console.log('Updated:', e.id, e.patch);
});

// Deletion
viewer.events.on('annotation:delete', (e) => {
  console.log('Deleted:', e.id);
});

// Measurement
viewer.events.on('annotation:measure', (e) => {
  console.log('Measurement:', e.id, e.result);
});
```

## Example: Custom Annotation Type

### Ellipse Measurement Plugin

```typescript
// 1. Schema
const ellipseSchema = {
  type: 'object',
  required: ['id', 'type', 'zIndex', 'space', 'geom'],
  properties: {
    id: { type: 'string' },
    type: { const: 'measure.ellipse' },
    zIndex: { type: 'number' },
    space: { enum: ['image'] },
    geom: {
      type: 'object',
      required: ['cx', 'cy', 'rx', 'ry', 'theta'],
      properties: {
        cx: { type: 'number' },
        cy: { type: 'number' },
        rx: { type: 'number' },
        ry: { type: 'number' },
        theta: { type: 'number' }  // radians
      }
    }
  }
};

// 2. Renderer
const ellipseRenderer: AnnRenderer = {
  draw(batch, io, view) {
    for (const ann of batch) {
      const { cx, cy, rx, ry, theta } = ann.geom;
      io.pushStyle(ann.style);
      io.ellipse({ cx, cy, rx, ry, theta, space: ann.space });
      io.stroke();
      io.popStyle();
    }
  },
  
  hitTest(pt, view, index) {
    const hits: Hit[] = [];
    for (const ann of index.queryScreenRadius(pt, 8)) {
      const d = distanceToEllipseBorderScreen(pt, ann, view);
      if (d <= 6) {
        hits.push({ id: ann.id, part: 'edge', distPx: d });
      }
    }
    return hits.sort((a, b) => a.distPx - b.distPx);
  }
};

// 3. Measurer
const ellipseMeasurer = {
  id: 'measure.ellipse.area-perimeter',
  measure(ann, ctx) {
    const { rx, ry } = ann.geom;
    const [sx, sy] = Array.isArray(ctx.pixelSpacing)
      ? ctx.pixelSpacing
      : [ctx.pixelSpacing.x, ctx.pixelSpacing.y];
    
    const areaPx2 = Math.PI * rx * ry;
    const areaMm2 = Math.PI * (rx / sx) * (ry / sy);
    
    // Ramanujan circumference approximation
    const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2);
    const periPx = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    const periMm = periPx / ((sx + sy) / 2);
    
    return {
      area: { px2: areaPx2, mm2: areaMm2 },
      perimeter: { px: periPx, mm: periMm }
    };
  }
};

// 4. Register
viewer.annotations.registerType({
  type: 'measure.ellipse',
  schema: ellipseSchema,
  renderer: ellipseRenderer,
  measurers: [ellipseMeasurer]
});
```

## Performance Considerations

### Batching
- Group annotations by type and style
- Minimize state changes (shader switches, style changes)
- Use instanced rendering for repeated shapes

### Spatial Indexing
- Update R-tree on commit (not during drag)
- Use zoom-aware tolerance for hit-testing
- Cache hit-test results when possible

### Rendering
- Viewport culling: Only render visible annotations
- LOD: Simplify complex shapes at low zoom
- Cache: Cache Path2D objects for Canvas2D backend

## Safety & Validation

### Schema Validation
- All annotations validated against schema on creation/update
- Prevents malformed geometry
- Type-safe API with TypeScript

### Strict Mode
- Diagnostic mode: Blocks rendering if validation fails
- Enforces unit-aware measurements
- Records all transforms for audit

