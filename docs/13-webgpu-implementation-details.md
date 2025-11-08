# WebGPU Implementation Details

## Overview

This document covers WebGPU-specific implementation details, optimizations, and advanced features that are unique to the WebGPU backend.

## Why WebGPU Over WebGL2

### Performance Benefits
- **Throughput & Parallelism**: Upload many small tiles efficiently using staging buffers + `COPY_BUFFER_TO_TEXTURE`
- **Batch Draws**: Use bind groups for efficient batching
- **Compute Passes**: GPU-side mip selection, prefetch scoring, histogramming without extra round-trips
- **Precision & Color**: Linear/sRGB control in shaders; deterministic float math vs GL quirks
- **Future-proof**: Native compute unlocks GPU-side LOD selection, tile packing, and image processing

### Architecture Decision: Don't Hard-Lock into Three.js
- Three.js has WebGPU renderer but is primarily a 3D scene-graph
- For 2D tile engine, Three adds unnecessary abstraction (materials, lights, bones)
- Complicates tight control of bind-group layouts, texture arrays, and compute passes
- **Compromise**: Use Three for UI/3D extras (optional overlays, 3D markers, gizmos)
- Keep deep-zoom core as standalone WebGPU module
- Provide adapter to mount inside React/framework for good DX

## WebGPU Rendering Pipeline

### Canvas Configuration
```typescript
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const device = await navigator.gpu.requestDevice();

await context.configure({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
  alphaMode: 'premultiplied'
});
```

### Bind Group Layout
```wgsl
// @group(0) global: sampler + (optional) LUT/colormap texture
// @group(1) tiles: texture array (or atlas) + per-frame uniforms
```

**Structure**:
- **Group 0 (Global)**:
  - Sampler (nearest/linear)
  - Optional LUT/colormap texture
  - Global uniforms (view matrix, gamma, etc.)
  
- **Group 1 (Tiles)**:
  - Texture array (or atlas) containing all tiles
  - Per-frame uniforms (viewport, zoom level)

### Instanced Quads

**Vertex Buffer**: 4 corners in NDC per instance via model matrix or per-instance rect

**Instance Buffer Contains**:
- Tile rect in world coordinates (x, y, width, height)
- UV rect (uMin, vMin, uMax, vMax)
- Texture array layer index
- Opacity
- Color flags (tint, blend mode)

### WGSL Shader Sketch

```wgsl
struct VSIn {
  @location(0) pos: vec2f;
  @location(1) rectMin: vec2f;
  @location(2) rectMax: vec2f;
  @location(3) uvMin: vec2f;
  @location(4) uvMax: vec2f;
  @location(5) layer: u32;
};

struct VSOut {
  @builtin(position) clip: vec4f;
  @location(0) uv: vec2f;
  @location(1) layer: u32;
};

@group(0) @binding(0) var samp: sampler;
@group(1) @binding(0) var texArr: texture_2d_array<f32>;
@group(0) @binding(1) var<uniform> u: struct {
  viewProj: mat4x4f;
  gamma: f32;
};

@vertex
fn vs(in: VSIn) -> VSOut {
  var out: VSOut;
  let p = mix(vec2f(in.rectMin), vec2f(in.rectMax), (in.pos + 1.0) * 0.5);
  out.clip = u.viewProj * vec4f(p, 0.0, 1.0);
  out.uv = mix(in.uvMin, in.uvMax, (in.pos + 1.0) * 0.5);
  out.layer = in.layer;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let c = textureSample(texArr, samp, in.uv, i32(in.layer));
  // sRGB decode/encode or LUT here if needed
  return c;
}
```

## Tile & LOD Strategy

### Quadtree Pyramid
- Each tile has `(level, x, y)` coordinates
- Use quadtree structure for efficient LOD selection

### Screen-Space Error Calculation
```typescript
function computeScreenSpaceError(tile: Tile, view: ViewUniforms): number {
  // Project tile size to screen space
  const tileSizePx = tile.size * view.zoom;
  const texelSizePx = tileSizePx / tile.textureSize;
  
  // If projected texel size > threshold, descend; else draw
  return texelSizePx;
}
```

### Priority Queue
Maintain priority queue for tile loading:
1. **Tiles in view** at current zoom (highest priority)
2. **Neighbors** along pan direction
3. **Parent/child** for smooth refine

### Prefetch Algorithm
```typescript
function calculatePrefetchScore(
  tile: Tile,
  viewport: Viewport,
  velocity: Vector2
): number {
  const visibility = isTileVisible(tile, viewport) ? 1.0 : 0.0;
  const velocityAlignment = calculateVelocityAlignment(tile, velocity);
  const distancePenalty = calculateDistancePenalty(tile, viewport);
  
  // Score = visibility * (1 + velocity alignment) - distance penalty
  return visibility * (1 + velocityAlignment) - distancePenalty;
}
```

## Tile Cache Strategy

### CPU Cache
- **Compressed bytes**: For retry (keep original data)
- **Decoded ImageBitmap**: Ready for GPU upload
- **LRU eviction**: Remove least recently used tiles

### GPU Cache
- **Resident GPUTexture**: Tracked by LRU
- **Pin tiles**: Currently in frame (don't evict)
- **Memory budget**: Track GPU VRAM usage

### Upload Strategy
```typescript
// Batch small tiles in one commandEncoder
const encoder = device.createCommandEncoder();

for (const tile of tilesToUpload) {
  encoder.copyExternalImageToTexture(
    { source: tile.imageBitmap },
    { texture: tile.gpuTexture },
    { width: tile.width, height: tile.height }
  );
}

device.queue.submit([encoder.finish()]);
```

### Texture Arrays vs Atlas
**Prefer texture arrays**:
- One `GPUSampler`
- One `BindGroup`
- Index per-instance
- Fewer binds than individual textures

## Compute Passes

### ComputePrefetchPass
GPU-side prefetch scoring:
```wgsl
@compute @workgroup_size(64)
fn computePrefetchScores(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  // Score tiles for prefetching
  // Output to buffer for CPU to read
}
```

### ComputeMosaicPass (Optional)
Stitch or downsample, generate custom mips:
```wgsl
@compute @workgroup_size(8, 8)
fn generateMipLevel(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  // Downsample from higher mip level
}
```

## Worker Architecture

### FetchWorker
- HTTP range or chunked requests
- Decompression (gzip, brotli)
- Retry logic with exponential backoff

### DecodeWorker
- PNG/JPEG/JPEG-XL/AVIF decoding
- Use `createImageBitmap` (browser native) or WASM decoder
- Offload decode from main thread

## Advanced Features

### Smooth LOD Morph
Fade between parent/child tiles during LOD transitions:
```typescript
function renderTileWithMorph(tile: Tile, parent: Tile, alpha: number) {
  // Render parent with opacity (1 - alpha)
  // Render child with opacity alpha
  // Blend for smooth transition
}
```

### Multichannel Compositing
Compose RGBA from 4 grayscale tiles:
```wgsl
@fragment
fn multichannelComposite(
  r: texture_2d<f32>,
  g: texture_2d<f32>,
  b: texture_2d<f32>,
  a: texture_2d<f32>,
  uv: vec2<f32>
) -> vec4<f32> {
  return vec4<f32>(
    textureSample(r, samp, uv).r,
    textureSample(g, samp, uv).r,
    textureSample(b, samp, uv).r,
    textureSample(a, samp, uv).r
  );
}
```

### Split-View / Swipe Comparison
Two pipelines, shared quadtree:
```typescript
interface SplitView {
  left: Viewport;
  right: Viewport;
  swipePosition: number;  // 0-1
  sharedQuadtree: Quadtree;
}
```

### Snapshot/Export
Use `copyTextureToBuffer` for viewport exports:
```typescript
async function exportViewport(
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number
): Promise<ImageData> {
  const buffer = device.createBuffer({
    size: width * height * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture },
    { buffer, bytesPerRow: width * 4 },
    { width, height }
  );
  device.queue.submit([encoder.finish()]);
  
  await buffer.mapAsync(GPUMapMode.READ);
  const data = new Uint8Array(buffer.getMappedRange());
  return new ImageData(new Uint8ClampedArray(data), width, height);
}
```

## Performance Optimizations

### Memory Budgeting
```typescript
class MemoryBudgeter {
  private cpuBytes = 0;
  private gpuBytes = 0;
  private maxCPUBytes = 512 * 1024 * 1024;  // 512 MB
  private maxGPUBytes = 1024 * 1024 * 1024;  // 1 GB
  
  trackTile(tile: Tile) {
    this.cpuBytes += tile.compressedSize;
    this.gpuBytes += tile.textureSize;
    
    if (this.cpuBytes > this.maxCPUBytes) {
      this.evictLRU('cpu');
    }
    if (this.gpuBytes > this.maxGPUBytes) {
      this.evictLRU('gpu');
    }
  }
}
```

### One Pass Per Frame
- Bind once, draw N instances
- Avoid per-tile binds
- Batch all tiles in single draw call

### Tile Size Recommendations
- **256-512px**: Optimal tile size
- **512px**: Sweet spot on modern GPUs
- Balance between memory and network overhead

## Controller Features

### Momentum / Inertia
Kinetic scrolling with deceleration:
```typescript
class MomentumController {
  private velocity: Vector2 = { x: 0, y: 0 };
  private friction = 0.95;
  
  update(deltaTime: number) {
    // Apply velocity
    this.viewport.pan(
      this.velocity.x * deltaTime,
      this.velocity.y * deltaTime
    );
    
    // Apply friction
    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;
    
    // Stop when velocity is negligible
    if (Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.y) < 0.1) {
      this.velocity = { x: 0, y: 0 };
    }
  }
}
```

### Touch Support
- Pinch-to-zoom
- Two-finger pan
- Single-finger draw (when tool active)

## Testing Strategy

### Playwright Visual Snapshots
```typescript
test('renders tiles correctly', async ({ page }) => {
  await page.goto('/viewer');
  await page.waitForSelector('canvas');
  
  // Use fixed tileset for deterministic results
  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot('tiles-rendered.png');
});
```

### GPU Timing
Per-commit GPU timing for performance regression detection:
```typescript
const querySet = device.createQuerySet({
  type: 'timestamp',
  count: 2
});

// Start timestamp
commandEncoder.writeTimestamp(querySet, 0);

// ... render ...

// End timestamp
commandEncoder.writeTimestamp(querySet, 1);

// Read back timing
const buffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
});

commandEncoder.resolveQuerySet(querySet, 0, 2, buffer, 0);
```

## Migration from OpenSeadragon

### Keep Existing Infrastructure
1. **Server & Pyramids**: Keep IIIF/Deep Zoom/XML/JSON as-is
2. **Tile Sources**: Adapter layer for existing tile sources
3. **API Compatibility**: Provide similar API surface where possible

### Migration Steps
1. **Replace Renderer**: Swap OSD renderer with Tessera WebGPU backend
2. **Update Event Handlers**: Map OSD events to Tessera events
3. **Migrate Annotations**: Convert OSD overlays to Tessera annotations
4. **Test Thoroughly**: Visual regression tests with same tilesets

### API Mapping
```typescript
// OpenSeadragon
viewer.addHandler('canvas-click', (event) => { ... });

// Tessera
viewer.events.on('pointer:click', (event) => { ... });
```

## When to Still Use Three.js

Use Three.js for:
- **3D Markers**: 3D overlays, markers, gizmos
- **UI Elements**: Complex 3D UI elements
- **Optional Overlays**: When 3D scene graph is beneficial

Don't use Three.js for:
- **Core Tile Rendering**: Use native WebGPU
- **2D Annotations**: Use Canvas2D or WebGPU 2D pipeline
- **Performance-Critical Paths**: Avoid Three.js overhead

## Internal State Snapshot

For debugging and inspection:
```typescript
interface InternalSnapshot {
  viewMatrix: mat4;
  zoom: number;
  velocity: Vector2;
  cacheStats: {
    cpuBytes: number;
    gpuBytes: number;
    tileCount: number;
    hitRate: number;
  };
  activeTiles: Tile[];
  queuedTiles: Tile[];
}

function inspect(): InternalSnapshot {
  return {
    viewMatrix: viewport.getViewMatrix(),
    zoom: viewport.getZoom(),
    velocity: controller.getVelocity(),
    cacheStats: tileCache.getStats(),
    activeTiles: tileCache.getActiveTiles(),
    queuedTiles: tileQueue.getQueuedTiles()
  };
}
```

## Color Management in WebGPU

### Linear Workflow
- Upload sRGB textures
- Sample as sRGB in shader
- Composite in linear space
- Convert at output

### LUT Support
For scientific/medical imagery:
- 1D/3D LUT bound at `@group(0)`
- Controlled per layer
- Applied in fragment shader

### ICC Profile Support
- Preprocess to working space (linear sRGB or Display-P3) in worker
- Flag tile's transfer in uniform
- Apply in shader or pre-process

## Performance Guardrails

### Image Decoding
- Use `createImageBitmap` for decode off main thread (where supported)
- Prefer AVIF/JPEG-XL (if you control the pyramid) → smaller, faster uploads

### Memory Management
- Track CPU & GPU bytes
- Down-rank least recently used tiles
- Shrink residency when tab is hidden

### Rendering
- One pass per frame: bind once, draw N instances
- Avoid per-tile binds
- Use instanced rendering

## Plugin Hooks

### Custom Fragment Ops
Allow plugins to inject custom fragment shader code:
```typescript
interface FragmentOp {
  code: string;  // WGSL code
  uniforms?: UniformDef[];
}

viewer.registerFragmentOp('edge-enhancement', {
  code: `
    // Sobel edge detection
    // ...
  `
});
```

Examples:
- Edge enhancement
- CLAHE (Contrast Limited Adaptive Histogram Equalization)
- Custom colormaps
- Tone mapping

