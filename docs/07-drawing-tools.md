# Drawing Tools

## Overview

The drawing tools system provides interactive creation and editing of annotations. Tools are separate from annotation types—one tool can create multiple types, and multiple tools can create the same type.

## Tool Architecture

### Tool Interface
```typescript
interface Tool {
  id: string;                    // e.g., 'tool.rectangle'
  forType?: string;               // Annotation type it creates (optional)
  forTypes?: string[];            // Multiple types (optional)
  
  // Event handlers
  onPointerDown?(e: ToolEvent, ctx: ToolCtx): void;
  onPointerMove?(e: ToolEvent, ctx: ToolCtx): void;
  onPointerUp?(e: ToolEvent, ctx: ToolCtx): void;
  onKey?(e: ToolKeyEvent, ctx: ToolCtx): void;
  
  // Visual feedback
  drawGizmos?(ann: Annotation, io: DrawIO, view: ViewUniforms): void;
  drawPreview?(geom: Geometry, io: DrawIO, view: ViewUniforms): void;
  
  // Configuration
  options?: ToolOptions;
}
```

### Tool Context
```typescript
interface ToolCtx {
  // Coordinate conversion
  toImage(e: ToolEvent): Point;
  toScreen(e: ToolEvent): Point;
  
  // Transaction management
  tx: Transaction;
  
  // State
  state: ToolState;
  
  // Modifiers
  modifiers(): { shift: boolean; alt: boolean; ctrl: boolean; meta: boolean };
  
  // Utilities
  newId(): string;
  topZ(): number;
  defaults(): DefaultStyle;
  
  // Preview
  preview: PreviewManager;
  
  // Measurement context
  measurement: MeasurementContext;
}
```

## Built-in Drawing Tools

### 1. Point Tool
**ID**: `'tool.point'`

**Behavior**: Click to place a point marker

**Options**:
- Marker style (circle, cross, custom)
- Size (px or mm)

### 2. Rectangle Tool
**ID**: `'tool.rectangle'`

**Behavior**: Click-drag to create rectangle

**Modifiers**:
- **Shift**: Constrain to square
- **Alt**: Draw from center
- **Ctrl**: Toggle snap

**Options**:
- Snap to grid
- Snap to angles (15°, 30°, 45°, etc.)
- Min size constraint

### 3. Ellipse Tool
**ID**: `'tool.ellipse'`

**Behavior**: Click-drag to create ellipse

**Modifiers**:
- **Shift**: Constrain to circle
- **Alt**: Draw from center
- **Ctrl**: Toggle snap

### 4. Polygon Tool
**ID**: `'tool.polygon'`

**Behavior**: Click to add vertices, double-click or Enter to close

**Modifiers**:
- **Shift**: Constrain angle (15° steps)
- **Backspace**: Remove last vertex
- **Enter**: Close polygon
- **Esc**: Cancel

**Options**:
- Auto-close tolerance
- Min vertices (3 for polygon)

### 5. Polyline Tool
**ID**: `'tool.polyline'`

**Behavior**: Click to add points, double-click or Enter to finish

**Modifiers**: Same as polygon

**Options**:
- Closed option (can create closed polyline)

### 6. Spline Tool
**ID**: `'tool.spline'`

**Behavior**: Click to place control points, drag to adjust tangents

**Modifiers**:
- **Shift**: Constrain tangents (straight)
- **Ctrl**: Toggle smooth/linear

**Options**:
- Spline degree (quadratic, cubic)
- Auto-smooth

### 7. Freehand Tool
**ID**: `'tool.freehand'`

**Behavior**: Press-drag to draw freehand path

**Options**:
- Smoothing (Chaikin passes)
- Simplification (Douglas-Peucker epsilon)
- Gap closing (max gap to auto-close)
- Sampling rate (Hz)

### 8. Lasso Tool
**ID**: `'tool.lasso'`

**Behavior**: Press-drag to draw freehand polygon, auto-closes on release

**Options**: Same as freehand

### 9. Text Tool
**ID**: `'tool.text'`

**Behavior**: Click to place text anchor or create text box

**Modes**:
- **Label mode**: Single-line label at anchor point
- **Box mode**: Multi-line text in fixed box
- **Callout mode**: Label with leader line

**Options**:
- Font family, size, weight
- Alignment (left, center, right)
- Wrap mode (none, word, char)

### 10. Ruler Tool
**ID**: `'tool.ruler'`

**Behavior**: Click two points to measure distance

**Options**:
- Show live measurement
- Unit display (µm, mm, px)

### 11. Angle Tool
**ID**: `'tool.angle'`

**Behavior**: Click three points to measure angle

**Options**:
- Show angle in degrees/radians

## Advanced Editing Tools

### 1. Select Tool
**ID**: `'tool.select'`

**Behavior**: Click to select, drag to move, drag handles to transform

**Features**:
- Single selection
- Multi-selection (Shift+click, box select)
- Transform handles (translate, rotate, scale)
- Direct vertex editing

### 2. Vertex Tool
**ID**: `'tool.vertex'`

**Behavior**: Edit individual vertices

**Operations**:
- **Drag vertex**: Move vertex
- **Double-click edge**: Insert vertex at midpoint
- **Hover edge + drag**: Insert vertex at closest point
- **Delete vertex**: Remove vertex (Backspace)
- **Weld vertices**: Merge nearby vertices

**Options**:
- Snap tolerance
- Min edge length
- Lock vertices

### 3. Edge Tool
**ID**: `'tool.edge'`

**Behavior**: Edit edges/segments

**Operations**:
- **Drag edge**: Move entire edge
- **Split edge**: Split at point
- **Straighten edge**: Fit line to edge
- **Arc fit**: Fit circular arc to edge
- **Fillet**: Round corner
- **Chamfer**: Bevel corner

### 4. Transform Tool
**ID**: `'tool.transform'`

**Behavior**: Transform entire shape

**Operations**:
- **Translate**: Move shape
- **Rotate**: Rotate around center
- **Scale**: Scale uniformly or non-uniformly
- **Skew**: Shear transformation
- **Mirror**: Reflect across axis

**Modifiers**:
- **Shift**: Constrain (square, circle, 15° angles)
- **Alt**: Transform from center
- **Ctrl**: Toggle snap

### 5. Boolean Tool
**ID**: `'tool.boolean'`

**Behavior**: Combine shapes with boolean operations

**Operations**:
- **Union**: Combine shapes
- **Intersect**: Keep overlapping region
- **Difference**: Subtract one from another
- **XOR**: Exclusive or

**Usage**: Select two shapes, choose operation

### 6. Offset Tool
**ID**: `'tool.offset'`

**Behavior**: Create parallel curve (buffer)

**Options**:
- Offset distance (px or mm)
- Join style (miter, round, bevel)
- Miter limit

### 7. Fillet Tool
**ID**: `'tool.fillet'`

**Behavior**: Round corners

**Options**:
- Fillet radius (px or mm)
- Apply to all corners or selected

### 8. Chamfer Tool
**ID**: `'tool.chamfer'`

**Behavior**: Bevel corners

**Options**:
- Chamfer distance (px or mm)

### 9. Knife Tool
**ID**: `'tool.knife'`

**Behavior**: Cut shape along path

**Usage**: Draw cut path across shape, splits into multiple shapes

### 10. Simplify Tool
**ID**: `'tool.simplify'`

**Behavior**: Reduce vertices while preserving shape

**Options**:
- Tolerance (Douglas-Peucker epsilon in µm)

### 11. Smooth Tool
**ID**: `'tool.smooth'`

**Behavior**: Smooth curves

**Options**:
- Smoothing passes (Chaikin)
- Corner preservation

## Tool Configuration

### Global Configuration
```typescript
viewer.tools.configure('rectangle', {
  snap: {
    grid: { unit: 'µm', step: 10 },
    angle: { stepDeg: 15 }
  },
  constrain: {
    squareWithShift: true,
    centerWithAlt: true
  },
  minSize: { unit: 'px-image', w: 1, h: 1 },
  defaultStyle: {
    stroke: '#0af',
    width: 1.5,
    fill: { kind: 'solid', color: '#0af22' }
  }
});
```

### Per-Tool Options
```typescript
interface ToolOptions {
  snap?: SnapOptions;
  constrain?: ConstrainOptions;
  minSize?: SizeConstraint;
  maxSize?: SizeConstraint;
  defaultStyle?: Style;
  cursor?: string;
  hints?: string[];
}
```

## Snapping System

### Snap Types
1. **Grid Snap**: Snap to grid (µm, mm, px-image, px-screen)
2. **Angle Snap**: Snap to angles (15°, 30°, 45°, etc.)
3. **Vertex Snap**: Snap to existing vertices
4. **Edge Snap**: Snap to edges (midpoints, intersections)
5. **Feature Snap**: Snap to detected features (corners, edges)

### Snap Configuration
```typescript
viewer.tools.setSnap({
  enabled: true,
  grid: { unit: 'µm', step: 10 },
  angles: [0, 15, 30, 45, 90],
  vertices: { enabled: true, tolerance: 5 },
  edges: { enabled: true, tolerance: 5 }
});
```

## Constraints

### Geometric Constraints
- **Min edge length**: Prevent degenerate edges
- **Min area**: Prevent tiny shapes
- **Aspect ratio**: Lock aspect ratio
- **Angle lock**: Lock angles (orthogonal, etc.)

### Unit-Aware Constraints
```typescript
viewer.tools.setConstraints({
  minEdgeLength: { unit: 'µm', value: 5 },
  minArea: { unit: 'mm²', value: 0.01 },
  aspectRatio: { locked: true, ratio: 16/9 }
});
```

## Live Preview

### Preview Rendering
- Tools render preview geometry during drawing
- Preview uses different style (e.g., dashed)
- Preview shows live measurements

### Preview Manager
```typescript
interface PreviewManager {
  set(geom: Geometry, style?: Style): void;
  clear(): void;
  update(geom: Geometry): void;
}
```

## Tool State Machine

### States
1. **idle**: No active tool
2. **preview**: Showing preview (hover)
3. **drawing**: Actively drawing
4. **editing**: Editing existing annotation

### Transitions
```
idle → (activate tool) → preview
preview → (pointer down) → drawing
drawing → (pointer move) → drawing (update)
drawing → (pointer up) → idle (commit) or editing
editing → (cancel) → idle
```

## Events

### Tool Events
```typescript
// Tool activation
viewer.events.on('tool:activate', (e) => {
  console.log('Tool activated:', e.toolId);
});

// Drawing started
viewer.events.on('tool:begin', (e) => {
  console.log('Drawing started:', e.toolId);
});

// Drawing updated
viewer.events.on('tool:update', (e) => {
  console.log('Geometry updated:', e.geom);
  console.log('Live metrics:', e.liveMetrics);
});

// Drawing committed
viewer.events.on('tool:commit', (e) => {
  console.log('Annotation created:', e.annId);
});

// Drawing cancelled
viewer.events.on('tool:cancel', (e) => {
  console.log('Drawing cancelled');
});

// Tool hints
viewer.events.on('tool:hint', (e) => {
  console.log('Hint:', e.message);
});
```

## Example: Rectangle Tool Implementation

```typescript
viewer.tools.register({
  id: 'tool.rectangle',
  forType: 'rectangle',
  
  onPointerDown(e, ctx) {
    const a = ctx.toImage(e);
    ctx.tx.begin();
    ctx.tx.create({
      id: ctx.newId(),
      type: 'rectangle',
      space: 'image',
      geom: { x: a.x, y: a.y, w: 0, h: 0, rotation: 0 },
      style: ctx.defaults().style
    });
    ctx.state.set('seed', a);
  },
  
  onPointerMove(e, ctx) {
    if (!ctx.tx.active()) return;
    
    const seed = ctx.state.get('seed');
    let b = ctx.toImage(e);
    const mod = ctx.modifiers();
    
    if (mod.alt) {
      // Draw from center
      const w = Math.abs(b.x - seed.x) * 2;
      const h = Math.abs(b.y - seed.y) * 2;
      if (mod.shift) {
        const s = Math.max(w, h);
        b = { x: seed.x + s/2, y: seed.y + s/2 };
        ctx.tx.patch({ geom: { x: seed.x - s/2, y: seed.y - s/2, w: s, h: s }});
      } else {
        ctx.tx.patch({ geom: { x: seed.x - w/2, y: seed.y - h/2, w, h }});
      }
    } else {
      // Draw from corner
      let w = b.x - seed.x;
      let h = b.y - seed.y;
      if (mod.shift) {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = w < 0 ? -s : s;
        h = h < 0 ? -s : s;
      }
      ctx.tx.patch({
        geom: {
          x: Math.min(seed.x, seed.x + w),
          y: Math.min(seed.y, seed.y + h),
          w: Math.abs(w),
          h: Math.abs(h)
        }
      });
    }
    
    // Update preview with live metrics
    ctx.preview.update(ctx.tx.current().geom);
    ctx.preview.metrics({
      w: ctx.toUnits('mm', 'x', Math.abs(b.x - seed.x)),
      h: ctx.toUnits('mm', 'y', Math.abs(b.y - seed.y))
    });
  },
  
  onPointerUp(e, ctx) {
    if (ctx.tx.active()) {
      ctx.tx.commit();
    }
  },
  
  onKey(e, ctx) {
    if (e.key === 'Escape' && ctx.tx.active()) {
      ctx.tx.cancel();
    }
  },
  
  drawGizmos(ann, io, view) {
    // Draw handles for editing
    const { x, y, w, h } = ann.geom;
    const handles = [
      { pos: { x, y }, cursor: 'nwse-resize' },
      { pos: { x: x + w, y }, cursor: 'nesw-resize' },
      { pos: { x: x + w, y: y + h }, cursor: 'nwse-resize' },
      { pos: { x, y: y + h }, cursor: 'nesw-resize' }
    ];
    handles.forEach(h => io.handle(h.pos, { cursor: h.cursor }));
  }
});
```

## Accessibility

### Keyboard Navigation
- **Arrow keys**: Move phantom cursor
- **Enter**: Place point/confirm
- **Shift**: Constrain
- **Ctrl**: Toggle snap
- **Esc**: Cancel
- **Tab**: Cycle through tools

### Screen Reader Support
- ARIA announcements for tool actions
- Focus management
- Keyboard shortcuts announced

## Touch & Stylus Support

### Touch Gestures
- **Single finger**: Draw/edit
- **Two finger**: Pan/zoom (viewer-level)
- **Long press**: Context menu

### Stylus Support
- **Pressure**: Optional pressure-sensitive stroke width
- **Tilt**: Optional tilt support
- **Palm rejection**: Prefer pen input over touch

## Performance

### Optimization Strategies
- **Debounce**: Debounce pointer move events
- **Throttle**: Throttle preview updates
- **Lazy evaluation**: Compute measurements on-demand
- **Spatial index**: Update R-tree on commit, not during drag

### Memory Management
- **Preview cleanup**: Clear preview on commit/cancel
- **State cleanup**: Clear tool state on deactivation
- **Event cleanup**: Remove listeners on tool deactivation

