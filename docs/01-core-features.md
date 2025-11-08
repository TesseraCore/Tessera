# Core Features

## Core Features (Must-Have)

### 1. Deep Zoom Rendering
- **Multi-level pyramid support**: TIFF, Zarr, DICOM, IIIF, custom formats
- **Smooth pan/zoom**: Hardware-accelerated with momentum
- **Tile caching**: Intelligent LRU cache with memory management
- **Multi-backend support**: WebGPU → WebGL2 → WebGL → Canvas2D (graceful degradation)
- **Viewport management**: Multiple viewports, synchronized or independent

### 2. Color Management
- **Color-accurate pipeline**: Linear working space, proper color profiles
- **Strict mode**: Diagnostic mode that blocks rendering if calibration fails
- **VOI LUT support**: Window/level for grayscale medical images
- **GSDF mapping**: Grayscale Standard Display Function for consistent perception
- **ICC profile support**: Source and display color profiles
- **Premultiplied alpha**: Correct compositing throughout

### 3. Annotation System
- **Plugin-based architecture**: Register custom annotation types
- **Multiple annotation types**: Points, lines, polygons, rectangles, ellipses, splines, text, etc.
- **Image-space coordinates**: All geometry stored in image pixels (zoom-invariant)
- **Z-indexing**: Layered annotations with proper ordering
- **Style system**: Reusable style dictionaries, per-annotation styling
- **Hit-testing**: Spatial index (R-tree) for fast selection
- **Measurement support**: Built-in measurers (area, perimeter, angle, etc.)

### 4. Drawing Tools
- **Interactive creation**: Click-to-create and draw-to-create modes
- **Shape tools**: Rectangle, ellipse, polygon, polyline, spline, freehand
- **Modifier keys**: Shift (constrain), Alt (from center), Ctrl (snap toggle)
- **Live preview**: Rubber-band previews while drawing
- **Undo/redo**: Transaction-based history
- **Snapping**: Grid, angles, vertices, edges

### 5. Advanced Editing
- **Vertex manipulation**: Drag corners, insert/delete vertices
- **Edge editing**: Split edges, insert points on segments, drag edges
- **Shape transforms**: Rotate, scale, skew, mirror
- **Boolean operations**: Union, intersect, difference, XOR
- **Fillet/chamfer**: Round or bevel corners
- **Offset/inset**: Buffer operations with unit awareness
- **Knife tool**: Cut shapes along a path
- **Proportional editing**: Soft falloff for organic tweaks

### 6. Units & Calibration
- **Dual coordinate systems**: Image-space (stable) and screen-space (viewport)
- **Unit registry**: Pluggable units (µm, mm, px, in, etc.)
- **Pixel spacing**: Support for anisotropic pixels (X ≠ Y)
- **Calibration tools**: Auto-calibrate from rulers/grids
- **Measurement context**: Unit-aware measurements with formatting
- **Scale bars**: Dynamic scale bars with proper units

### 7. Text Annotations
- **Rich text**: Bold, italic, color, underline
- **Emoji support**: Full Unicode emoji with proper rendering
- **Inline images**: Paste images into text annotations
- **Multiple layouts**: Single-line labels, multi-line boxes, callouts
- **Unit-aware sizing**: px-screen, px-image, pt, mm
- **Text shaping**: HarfBuzz for complex scripts, ligatures, bidi

### 8. Plugin System
- **Type registration**: Register custom annotation types
- **Renderer plugins**: GPU and Canvas2D renderers
- **Tool plugins**: Custom drawing/editing tools
- **Measurer plugins**: Custom measurement algorithms
- **Import/export plugins**: GeoJSON, WKT, DICOM SR, FHIR
- **Calibration plugins**: Custom calibration algorithms

## Side Features (Nice-to-Have)

### 1. Collaboration
- **CRDT/OT support**: Collaborative editing via transaction log
- **Real-time sync**: WebSocket-based synchronization
- **Conflict resolution**: Merge strategies for concurrent edits

### 2. Accessibility
- **Keyboard navigation**: Full keyboard-driven workflow
- **Screen reader support**: ARIA announcements, focus management
- **High contrast**: CVD-friendly color schemes
- **Focus indicators**: Clear focus rings

### 3. Export & Interop
- **Vector export**: SVG, PDF with embedded fonts
- **Raster export**: PNG, JPEG with proper color space
- **GeoJSON/WKT**: Standard GIS formats
- **DICOM SR**: Structured reports for medical use
- **Snapshots**: High-res exports with annotations

### 4. Performance Optimizations
- **Worker threads**: Offload heavy computation (FFT, RANSAC, boolean ops)
- **Spatial indexing**: R-tree for fast hit-testing
- **Batch rendering**: Instanced rendering for GPU backends
- **Lazy loading**: Load annotations on-demand
- **Viewport culling**: Only render visible annotations

### 5. UI Enhancements
- **Snapping UI**: Visual grid, angle guides
- **Measurement overlays**: Live measurements during drawing
- **Tool hints**: Contextual help and shortcuts
- **Custom cursors**: Tool-specific cursors
- **Multi-touch**: Gesture support for tablets

### 6. Advanced Features
- **Redaction/obfuscation**: Overlay masks (never modify source)
- **Time-varying annotations**: Animate annotations over time
- **Layer system**: Multiple image layers with blending
- **Mosaics**: Stitch multiple images together
- **3D annotations**: Future support for volumetric data

