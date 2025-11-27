/**
 * WebGPU rendering backend
 * 
 * Features:
 * - GPU-accelerated tile rendering
 * - Texture management for tiles
 * - Efficient instanced rendering
 * - Canvas2D fallback for complex operations
 */

import { BaseBackend } from './base.js';
import type { Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

// WebGPU type declarations for TypeScript
// These are minimal declarations to make the code compile
// Full types are available from @webgpu/types package
declare global {
  interface Navigator {
    gpu?: GPU;
  }
  
  interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): GPUTextureFormat;
  }
  
  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>;
  }
  
  interface GPUDevice {
    createShaderModule(descriptor: { code: string }): GPUShaderModule;
    createBindGroupLayout(descriptor: any): GPUBindGroupLayout;
    createPipelineLayout(descriptor: any): GPUPipelineLayout;
    createRenderPipeline(descriptor: any): GPURenderPipeline;
    createBuffer(descriptor: { size: number; usage: number }): GPUBuffer;
    createSampler(descriptor: any): GPUSampler;
    createTexture(descriptor: any): GPUTexture;
    createBindGroup(descriptor: any): GPUBindGroup;
    createCommandEncoder(): GPUCommandEncoder;
    queue: GPUQueue;
  }
  
  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBuffer | ArrayBufferView): void;
    copyExternalImageToTexture(source: any, destination: any, copySize: any): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }
  
  interface GPUShaderModule {}
  interface GPUBindGroupLayout {}
  interface GPUPipelineLayout {}
  interface GPURenderPipeline {}
  interface GPUBuffer { destroy(): void; }
  interface GPUSampler {}
  interface GPUTexture {
    createView(): GPUTextureView;
    destroy(): void;
  }
  interface GPUTextureView {}
  interface GPUBindGroup {}
  interface GPUCommandEncoder {
    beginRenderPass(descriptor: any): GPURenderPassEncoder;
    finish(): GPUCommandBuffer;
  }
  interface GPUCommandBuffer {}
  interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    draw(vertexCount: number): void;
    end(): void;
  }
  interface GPUCanvasContext {
    configure(descriptor: any): void;
    getCurrentTexture(): GPUTexture;
  }
  
  type GPUTextureFormat = 'bgra8unorm' | 'rgba8unorm' | string;
  
  const GPUShaderStage: {
    VERTEX: number;
    FRAGMENT: number;
    COMPUTE: number;
  };
  
  const GPUBufferUsage: {
    MAP_READ: number;
    MAP_WRITE: number;
    COPY_SRC: number;
    COPY_DST: number;
    INDEX: number;
    VERTEX: number;
    UNIFORM: number;
    STORAGE: number;
    INDIRECT: number;
    QUERY_RESOLVE: number;
  };
  
  const GPUTextureUsage: {
    COPY_SRC: number;
    COPY_DST: number;
    TEXTURE_BINDING: number;
    STORAGE_BINDING: number;
    RENDER_ATTACHMENT: number;
  };
}

// WGSL shader source (embedded)
const TILE_SHADER = `
// Uniforms for simple tile rendering
struct TileUniforms {
    view_matrix_row0: vec4<f32>,
    view_matrix_row1: vec4<f32>,
    view_matrix_row2: vec4<f32>,
    viewport_size: vec2<f32>,
    tile_rect: vec4<f32>,
    opacity: f32,
    _padding: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: TileUniforms;
@group(1) @binding(0) var tile_texture: texture_2d<f32>;
@group(1) @binding(1) var tile_sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var output: VertexOutput;
    
    // Generate quad vertices (2 triangles, 6 vertices)
    var local_pos: vec2<f32>;
    var local_uv: vec2<f32>;
    
    switch (vertex_index) {
        case 0u: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
        case 1u, 4u: {
            local_pos = vec2<f32>(1.0, 0.0);
            local_uv = vec2<f32>(1.0, 0.0);
        }
        case 2u, 3u: {
            local_pos = vec2<f32>(0.0, 1.0);
            local_uv = vec2<f32>(0.0, 1.0);
        }
        case 5u: {
            local_pos = vec2<f32>(1.0, 1.0);
            local_uv = vec2<f32>(1.0, 1.0);
        }
        default: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
    }
    
    // Transform to image space
    let rect = uniforms.tile_rect;
    let image_pos = vec2<f32>(
        rect.x + local_pos.x * rect.z,
        rect.y + local_pos.y * rect.w
    );
    
    // Apply view transform
    let m0 = uniforms.view_matrix_row0;
    let m1 = uniforms.view_matrix_row1;
    let screen_x = m0.x * image_pos.x + m0.y * image_pos.y + m0.z;
    let screen_y = m1.x * image_pos.x + m1.y * image_pos.y + m1.z;
    
    // Screen to clip space
    let clip_x = (screen_x / uniforms.viewport_size.x) * 2.0 - 1.0;
    let clip_y = 1.0 - (screen_y / uniforms.viewport_size.y) * 2.0;
    
    output.position = vec4<f32>(clip_x, clip_y, 0.0, 1.0);
    output.uv = local_uv;
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(tile_texture, tile_sampler, input.uv);
    return vec4<f32>(color.rgb, color.a * uniforms.opacity);
}
`;


/**
 * Cached texture for a tile
 */
interface TileTextureEntry {
  texture: GPUTexture;
  bindGroup: GPUBindGroup;
  lastAccess: number;
  width: number;
  height: number;
}

/**
 * WebGPU rendering backend with full GPU pipeline
 * 
 * Optimizations:
 * - Lazy pipeline initialization (defer until first render)
 * - Deferred texture uploads to avoid blocking render frames
 */
export class WebGPUBackend extends BaseBackend {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  
  // Render pipelines (lazy initialized)
  private tilePipeline: GPURenderPipeline | null = null;
  private pipelinesInitialized = false;
  private pipelineInitPromise: Promise<void> | null = null;
  // Clear pipeline reserved for future use
  // private clearPipeline: GPURenderPipeline | null = null;
  
  // Bind group layouts
  private tileUniformLayout: GPUBindGroupLayout | null = null;
  private tileTextureLayout: GPUBindGroupLayout | null = null;
  
  // Uniform buffers
  private tileUniformBuffer: GPUBuffer | null = null;
  // Clear uniforms reserved for future use
  // private clearUniformBuffer: GPUBuffer | null = null;
  // private clearBindGroup: GPUBindGroup | null = null;
  
  // Sampler
  private tileSampler: GPUSampler | null = null;
  
  // Tile texture cache
  private textureCache = new Map<string, TileTextureEntry>();
  private maxCachedTextures = 256;
  
  // Fallback for unsupported operations
  private fallbackCanvas: HTMLCanvasElement | null = null;
  private fallbackCtx: CanvasRenderingContext2D | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check WebGPU support
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU is not supported');
    }

    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter');
    }

    this.device = await adapter.requestDevice();
    this.canvas = canvas;
    
    // Get WebGPU context
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      throw new Error('Failed to get WebGPU context');
    }
    
    this.context = context;
    this.format = gpu.getPreferredCanvasFormat();
    
    // Configure canvas
    context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.width = canvas.width;
    this.height = canvas.height;
    
    // OPTIMIZATION: Defer pipeline initialization until first render
    // This allows the viewer to become responsive faster
    // Pipelines will be created lazily on first renderTiles() call
    
    // Create fallback canvas for complex operations (lightweight)
    this.fallbackCanvas = document.createElement('canvas');
    this.fallbackCanvas.width = canvas.width;
    this.fallbackCanvas.height = canvas.height;
    this.fallbackCtx = this.fallbackCanvas.getContext('2d');
    
    this.initialized = true;
  }

  /**
   * Ensure pipelines are initialized (lazy initialization)
   */
  private async ensurePipelinesInitialized(): Promise<boolean> {
    if (this.pipelinesInitialized) {
      return true;
    }
    
    if (this.pipelineInitPromise) {
      await this.pipelineInitPromise;
      return this.pipelinesInitialized;
    }
    
    this.pipelineInitPromise = this.initializePipelines();
    await this.pipelineInitPromise;
    this.pipelinesInitialized = true;
    return true;
  }

  private async initializePipelines(): Promise<void> {
    if (!this.device) return;
    
    // Create tile uniform bind group layout
    this.tileUniformLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });
    
    // Create tile texture bind group layout
    this.tileTextureLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    });
    
    // Create tile pipeline
    const tileModule = this.device.createShaderModule({
      code: TILE_SHADER,
    });
    
    this.tilePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.tileUniformLayout, this.tileTextureLayout],
      }),
      vertex: {
        module: tileModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: tileModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
    
    // Clear pipeline is reserved for future use (background color customization)
    // For now, we use render pass clear value
    
    // Create uniform buffers
    // Tile uniforms: 4 vec4s (64 bytes) + padding = 80 bytes, aligned to 256
    this.tileUniformBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create sampler
    this.tileSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
  }

  resize(width: number, height: number): void {
    super.resize(width, height);
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    if (this.fallbackCanvas) {
      this.fallbackCanvas.width = width;
      this.fallbackCanvas.height = height;
    }
    
    // Reconfigure context
    if (this.context && this.device) {
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });
    }
  }

  clear(): void {
    // Clear is handled in renderTiles to avoid double-clearing
  }

  async renderTiles(tiles: Tile[], view: ViewUniforms): Promise<void> {
    if (!this.device || !this.context) {
      console.warn('[WebGPU] Device not ready, using fallback');
      return this.renderTilesFallback(tiles, view);
    }
    
    // Lazy initialize pipelines on first render
    if (!this.pipelinesInitialized) {
      await this.ensurePipelinesInitialized();
    }
    
    if (!this.tilePipeline || !this.tileUniformBuffer) {
      console.warn('[WebGPU] Pipeline not ready after init, using fallback');
      return this.renderTilesFallback(tiles, view);
    }
    
    // Get current texture
    let texture: GPUTexture;
    try {
      texture = this.context.getCurrentTexture();
    } catch (e) {
      console.warn('[WebGPU] Failed to get current texture:', e);
      return this.renderTilesFallback(tiles, view);
    }
    
    const textureView = texture.createView();
    
    // Create command encoder
    const encoder = this.device.createCommandEncoder();
    
    // Render pass
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.04, g: 0.04, b: 0.04, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    // Render each tile
    renderPass.setPipeline(this.tilePipeline);
    
    for (const tile of tiles) {
      if (!tile.imageBitmap) continue;
      
      // Get or create texture for this tile
      const textureEntry = await this.getOrCreateTileTexture(tile);
      if (!textureEntry) continue;
      
      // Update uniforms for this tile
      this.updateTileUniforms(view, tile);
      
      // Create uniform bind group
      const uniformBindGroup = this.device.createBindGroup({
        layout: this.tileUniformLayout!,
        entries: [{
          binding: 0,
          resource: { buffer: this.tileUniformBuffer },
        }],
      });
      
      renderPass.setBindGroup(0, uniformBindGroup);
      renderPass.setBindGroup(1, textureEntry.bindGroup);
      renderPass.draw(6); // 6 vertices for 2 triangles
    }
    
    renderPass.end();
    
    // Submit commands
    this.device.queue.submit([encoder.finish()]);
    
    // Clean up old textures
    this.cleanupTextureCache();
  }

  private updateTileUniforms(view: ViewUniforms, tile: Tile): void {
    if (!this.device || !this.tileUniformBuffer) return;
    
    // Prepare uniform data
    // Layout:
    // - view_matrix_row0: vec4 (16 bytes)
    // - view_matrix_row1: vec4 (16 bytes)
    // - view_matrix_row2: vec4 (16 bytes)
    // - viewport_size: vec2 (8 bytes) + padding (8 bytes)
    // - tile_rect: vec4 (16 bytes)
    // - opacity + padding: vec4 (16 bytes)
    // Total: 80 bytes
    
    const data = new Float32Array(20);
    
    // View matrix rows
    const m = view.viewMatrix;
    data[0] = m[0] ?? 1;  // m00
    data[1] = m[1] ?? 0;  // m01
    data[2] = m[2] ?? 0;  // m02
    data[3] = 0;          // padding
    
    data[4] = m[3] ?? 0;  // m10
    data[5] = m[4] ?? 1;  // m11
    data[6] = m[5] ?? 0;  // m12
    data[7] = 0;          // padding
    
    data[8] = m[6] ?? 0;  // m20
    data[9] = m[7] ?? 0;  // m21
    data[10] = m[8] ?? 1; // m22
    data[11] = 0;         // padding
    
    // Viewport size
    data[12] = view.viewportSize[0];
    data[13] = view.viewportSize[1];
    data[14] = 0;  // padding
    data[15] = 0;  // padding
    
    // Tile rect (imageX, imageY, width, height)
    data[16] = tile.imageX;
    data[17] = tile.imageY;
    data[18] = tile.width;
    data[19] = tile.height;
    
    // Opacity (in next vec4)
    const dataWithOpacity = new Float32Array(24);
    dataWithOpacity.set(data);
    dataWithOpacity[20] = 1.0; // opacity
    dataWithOpacity[21] = 0;   // padding
    dataWithOpacity[22] = 0;   // padding
    dataWithOpacity[23] = 0;   // padding
    
    this.device.queue.writeBuffer(this.tileUniformBuffer, 0, dataWithOpacity);
  }

  private async getOrCreateTileTexture(tile: Tile): Promise<TileTextureEntry | null> {
    if (!this.device || !tile.imageBitmap || !this.tileTextureLayout || !this.tileSampler) {
      return null;
    }
    
    const key = `${tile.level}:${tile.x}:${tile.y}`;
    
    // Check cache
    let entry = this.textureCache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry;
    }
    
    try {
      // Create texture
      const texture = this.device.createTexture({
        size: [tile.imageBitmap.width, tile.imageBitmap.height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      
      // Copy ImageBitmap to texture
      this.device.queue.copyExternalImageToTexture(
        { source: tile.imageBitmap },
        { texture },
        [tile.imageBitmap.width, tile.imageBitmap.height]
      );
      
      // Create bind group
      const bindGroup = this.device.createBindGroup({
        layout: this.tileTextureLayout,
        entries: [
          {
            binding: 0,
            resource: texture.createView(),
          },
          {
            binding: 1,
            resource: this.tileSampler,
          },
        ],
      });
      
      entry = {
        texture,
        bindGroup,
        lastAccess: Date.now(),
        width: tile.imageBitmap.width,
        height: tile.imageBitmap.height,
      };
      
      this.textureCache.set(key, entry);
      return entry;
    } catch (error) {
      console.error('[WebGPU] Failed to create tile texture:', error);
      return null;
    }
  }

  private cleanupTextureCache(): void {
    if (this.textureCache.size <= this.maxCachedTextures) return;
    
    // Sort by last access time and remove oldest
    const entries = Array.from(this.textureCache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    const toRemove = entries.slice(0, entries.length - this.maxCachedTextures);
    for (const [key, entry] of toRemove) {
      entry.texture.destroy();
      this.textureCache.delete(key);
    }
  }

  /**
   * Fallback rendering using Canvas2D
   */
  private async renderTilesFallback(tiles: Tile[], view: ViewUniforms): Promise<void> {
    if (!this.context || !this.device || !this.canvas) return;
    
    // Use fallback canvas
    if (!this.fallbackCtx || !this.fallbackCanvas) {
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.width = this.canvas.width;
      this.fallbackCanvas.height = this.canvas.height;
      this.fallbackCtx = this.fallbackCanvas.getContext('2d');
    }
    
    if (!this.fallbackCtx) return;
    
    const ctx = this.fallbackCtx;
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, this.fallbackCanvas.width, this.fallbackCanvas.height);
    
    // Apply view transform
    const m = view.viewMatrix;
    ctx.save();
    ctx.setTransform(
      m[0] ?? 1, m[3] ?? 0,
      m[1] ?? 0, m[4] ?? 1,
      m[2] ?? 0, m[5] ?? 0
    );
    
    // Draw tiles
    for (const tile of tiles) {
      if (!tile.imageBitmap) continue;
      try {
        ctx.drawImage(tile.imageBitmap, tile.imageX, tile.imageY, tile.width, tile.height);
      } catch (e) {
        console.error('[WebGPU Fallback] Draw error:', e);
      }
    }
    
    ctx.restore();
    
    // Copy to WebGPU
    try {
      const texture = this.context.getCurrentTexture();
      const bitmap = await createImageBitmap(this.fallbackCanvas);
      this.device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture },
        [bitmap.width, bitmap.height]
      );
      bitmap.close();
    } catch (e) {
      console.error('[WebGPU] Fallback copy failed:', e);
    }
  }

  renderAnnotations(_batch: AnnotationBatch, _view: ViewUniforms): void {
    // TODO: Implement GPU-accelerated annotation rendering
  }

  renderOverlays(_overlays: Overlay[], _view: ViewUniforms): void {
    // TODO: Implement GPU-accelerated overlay rendering
  }

  async uploadTile(tile: Tile): Promise<void> {
    // Pre-upload tile texture to cache
    await this.getOrCreateTileTexture(tile);
  }

  /**
   * Get GPU memory usage estimate
   */
  getGPUMemoryUsage(): number {
    let bytes = 0;
    for (const entry of this.textureCache.values()) {
      bytes += entry.width * entry.height * 4; // RGBA
    }
    return bytes;
  }

  destroy(): void {
    // Clean up textures
    for (const entry of this.textureCache.values()) {
      entry.texture.destroy();
    }
    this.textureCache.clear();
    
    // Clean up buffers
    this.tileUniformBuffer?.destroy();
    
    // Clean up fallback
    this.fallbackCanvas = null;
    this.fallbackCtx = null;
    
    // Reset state
    this.device = null;
    this.context = null;
    this.tilePipeline = null;
    this.tileUniformLayout = null;
    this.tileTextureLayout = null;
    this.tileUniformBuffer = null;
    this.tileSampler = null;
    
    if (super.destroy) {
      super.destroy();
    }
  }
}
