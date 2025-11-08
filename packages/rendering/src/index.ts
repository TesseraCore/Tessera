/**
 * @tessera/rendering - Rendering engine
 */

// Backends
export { WebGPUBackend } from './backend/webgpu.js';
export { WebGL2Backend } from './backend/webgl2.js';
export { WebGLBackend } from './backend/webgl.js';
export { Canvas2DBackend } from './backend/canvas2d.js';
export { BaseBackend } from './backend/base.js';

// Backend types
export type { RenderBackend, Tile, AnnotationBatch, Overlay, ViewUniforms } from './backend/types.js';

// Tile management
export { TileManager } from './tiles/manager.js';
export { TileCache } from './tiles/cache.js';
export type { TileSource, TileSourceOptions } from './tiles/source.js';
export type { CacheStats, CacheOptions } from './tiles/cache.js';
export type { TileManagerOptions } from './tiles/manager.js';

// Color pipeline (stubs for now)
export { ColorPipeline } from './color/pipeline.js';
export { LUT } from './color/lut.js';
export { ColorProfile } from './color/profile.js';

