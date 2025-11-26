/**
 * WebGL rendering backend
 */

import { BaseBackend } from './base.js';
import type { Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

/**
 * WebGL rendering backend (fallback for older browsers)
 */
export class WebGLBackend extends BaseBackend {
  private gl: WebGLRenderingContext | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('WebGL is not supported');
    }

    this.gl = gl;
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.initialized = true;

    // Set up WebGL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  }

  resize(width: number, height: number): void {
    super.resize(width, height);
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  clear(): void {
    if (!this.gl) return;
    
    // Clear to dark background color (matching page background)
    // RGB: 0x0a = 10/255 ≈ 0.039
    this.gl.clearColor(0.039, 0.039, 0.039, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  renderTiles(_tiles: Tile[], _view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement tile rendering with WebGL
    // Limited features compared to WebGL2
  }

  renderAnnotations(_batch: AnnotationBatch, _view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement annotation rendering
  }

  renderOverlays(_overlays: Overlay[], _view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement overlay rendering
  }

  async uploadTile(tile: Tile): Promise<void> {
    if (!this.gl || !tile.imageBitmap) return;
    
    // TODO: Upload tile to WebGL texture
  }

  destroy(): void {
    if (super.destroy) {
      super.destroy();
    }
    
    if (this.gl) {
      // Clean up WebGL resources
      // TODO: Delete textures, buffers, programs
    }
    
    this.gl = null;
  }
}
