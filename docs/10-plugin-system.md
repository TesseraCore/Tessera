# Plugin System

## Overview

The plugin system allows developers to extend Tessera with custom annotation types, tools, renderers, measurers, and import/export formats. All extensions are registered at runtime.

## Plugin Types

### 1. Annotation Type Plugins
Register custom annotation shapes/types

### 2. Renderer Plugins
Custom rendering logic (GPU/Canvas)

### 3. Tool Plugins
Custom drawing/editing tools

### 4. Measurer Plugins
Custom measurement algorithms

### 5. Import/Export Plugins
File format support

### 6. Calibration Plugins
Custom calibration algorithms

## Annotation Type Plugin

### Registration
```typescript
viewer.annotations.registerType({
  type: 'custom.shape',
  schema: jsonSchema,
  renderer: {
    draw(batch, io, view) { /* ... */ },
    hitTest(pt, view, index) { /* ... */ }
  },
  measurers: [customMeasurer],
  importers: { fromGeoJSON, fromWKT },
  exporters: { toGeoJSON, toWKT }
});
```

### Schema
JSON Schema for validation:
```typescript
const schema = {
  type: 'object',
  required: ['id', 'type', 'zIndex', 'space', 'geom'],
  properties: {
    id: { type: 'string' },
    type: { const: 'custom.shape' },
    geom: {
      type: 'object',
      properties: {
        // Custom geometry properties
      }
    }
  }
};
```

### Renderer
```typescript
interface AnnRenderer {
  draw(
    batch: Annotation[],
    io: DrawIO,
    view: ViewUniforms
  ): void;
  
  hitTest(
    pt: Point,
    view: ViewUniforms,
    index: SpatialIndex
  ): Hit[];
  
  outline?(
    ann: Annotation,
    view: ViewUniforms
  ): Path2DLike;
}
```

## Tool Plugin

### Registration
```typescript
viewer.tools.register({
  id: 'tool.custom',
  forType: 'custom.shape',
  onPointerDown(e, ctx) { /* ... */ },
  onPointerMove(e, ctx) { /* ... */ },
  onPointerUp(e, ctx) { /* ... */ },
  onKey(e, ctx) { /* ... */ },
  drawGizmos(ann, io, view) { /* ... */ }
});
```

### Tool Interface
```typescript
interface Tool {
  id: string;
  forType?: string;
  forTypes?: string[];
  onPointerDown?(e: ToolEvent, ctx: ToolCtx): void;
  onPointerMove?(e: ToolEvent, ctx: ToolCtx): void;
  onPointerUp?(e: ToolEvent, ctx: ToolCtx): void;
  onKey?(e: ToolKeyEvent, ctx: ToolCtx): void;
  drawGizmos?(ann: Annotation, io: DrawIO, view: ViewUniforms): void;
  drawPreview?(geom: Geometry, io: DrawIO, view: ViewUniforms): void;
  options?: ToolOptions;
}
```

## Measurer Plugin

### Registration
```typescript
const customMeasurer = {
  id: 'measure.custom.metric',
  measure(ann: Annotation, ctx: MeasurementContext) {
    // Compute measurement
    return {
      customMetric: {
        px: valuePx,
        mm: valueMm
      }
    };
  }
};

viewer.annotations.registerType({
  type: 'custom.shape',
  // ...
  measurers: [customMeasurer]
});
```

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

## Import/Export Plugins

### Registration
```typescript
viewer.annotations.registerType({
  type: 'custom.shape',
  // ...
  importers: {
    fromGeoJSON: (feature) => {
      // Convert GeoJSON to annotation
      return annotation;
    },
    fromWKT: (wkt) => {
      // Convert WKT to annotation
      return annotation;
    }
  },
  exporters: {
    toGeoJSON: (ann) => {
      // Convert annotation to GeoJSON
      return feature;
    },
    toWKT: (ann) => {
      // Convert annotation to WKT
      return wktString;
    }
  }
});
```

## Calibration Plugin

### Registration
```typescript
viewer.calibration.register({
  id: 'custom.calibration',
  run(options) {
    // Run calibration
    return result;
  },
  verify(options) {
    // Verify calibration
    return verificationResult;
  },
  ui: {
    // Optional UI component
    component: CalibrationUI
  }
});
```

## Plugin Lifecycle

### 1. Registration
Plugin registers with system:
```typescript
viewer.annotations.registerType(config);
```

### 2. Validation
System validates plugin:
- Schema validation
- Interface compliance
- Capability checks

### 3. Initialization
Plugin-specific setup:
```typescript
// Optional initialization hook
plugin.onRegister?.(viewer);
```

### 4. Runtime
Plugin handles events/rendering:
- Tools respond to user input
- Renderers draw annotations
- Measurers compute values

### 5. Cleanup
Unregister and cleanup:
```typescript
viewer.annotations.unregisterType('custom.shape');
```

## Plugin Examples

### Example 1: Ellipse Measurement
See `06-annotation-system.md` for full example.

### Example 2: Custom ROI Tool
```typescript
// Register annotation type
viewer.annotations.registerType({
  type: 'roi.custom',
  schema: customSchema,
  renderer: customRenderer,
  measurers: [areaMeasurer]
});

// Register tool
viewer.tools.register({
  id: 'tool.roi.custom',
  forType: 'roi.custom',
  onPointerDown(e, ctx) {
    // Start drawing
  },
  onPointerMove(e, ctx) {
    // Update geometry
  },
  onPointerUp(e, ctx) {
    // Commit annotation
  }
});
```

## Plugin Best Practices

### 1. Schema Validation
Always provide JSON Schema for validation:
- Prevents malformed data
- Enables type checking
- Documents structure

### 2. Image-Space Coordinates
Store all geometry in image-space:
- Zoom-invariant
- Measurement-accurate
- Consistent behavior

### 3. Unit Awareness
Use measurement context for units:
- Convert pixels to physical units
- Respect user preferences
- Format appropriately

### 4. Performance
Optimize rendering and hit-testing:
- Batch annotations
- Use spatial index
- Cache computations

### 5. Error Handling
Handle errors gracefully:
- Validate inputs
- Provide error messages
- Fallback behavior

## Plugin Template

### Minimal Template
```typescript
// 1. Schema
const schema = { /* JSON Schema */ };

// 2. Renderer
const renderer: AnnRenderer = {
  draw(batch, io, view) { /* ... */ },
  hitTest(pt, view, index) { /* ... */ }
};

// 3. Measurer (optional)
const measurer: Measurer = {
  id: 'measure.custom',
  measure(ann, ctx) { /* ... */ }
};

// 4. Tool (optional)
const tool: Tool = {
  id: 'tool.custom',
  forType: 'custom.type',
  onPointerDown(e, ctx) { /* ... */ },
  // ...
};

// 5. Register
viewer.annotations.registerType({
  type: 'custom.type',
  schema,
  renderer,
  measurers: [measurer]
});

viewer.tools.register(tool);
```

## Plugin Distribution

### Packaging
- NPM package
- ES modules
- TypeScript definitions
- Documentation

### Example Package Structure
```
my-tessera-plugin/
├── src/
│   ├── index.ts
│   ├── schema.ts
│   ├── renderer.ts
│   ├── measurer.ts
│   └── tool.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Usage
```typescript
import { registerCustomPlugin } from 'my-tessera-plugin';

registerCustomPlugin(viewer);
```

## Plugin API Reference

### Annotation System
```typescript
interface AnnotationSystem {
  registerType(config: AnnotationTypeConfig): void;
  unregisterType(type: string): void;
  getType(type: string): AnnotationType | undefined;
}
```

### Tool System
```typescript
interface ToolSystem {
  register(tool: Tool): void;
  unregister(toolId: string): void;
  get(toolId: string): Tool | undefined;
}
```

### Calibration System
```typescript
interface CalibrationSystem {
  register(calibrator: Calibrator): void;
  unregister(id: string): void;
}
```

