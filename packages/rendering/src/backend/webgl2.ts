/**
 * WebGL2 rendering backend
 */

import { BaseBackend } from './base.js';
import type { Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

/**
 * WebGL2 rendering backend
 */
export class WebGL2Backend extends BaseBackend {
  private gl: WebGL2RenderingContext | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('WebGL2 is not supported');
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

  renderTiles(tiles: Tile[], view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement tile rendering with WebGL2
    // Use texture arrays or multiple textures
    // Set up shaders and render quads
  }

  renderAnnotations(batch: AnnotationBatch, view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement annotation rendering
  }

  renderOverlays(overlays: Overlay[], view: ViewUniforms): void {
    if (!this.gl) return;
    
    // TODO: Implement overlay rendering
  }

  async uploadTile(tile: Tile): Promise<void> {
    if (!this.gl || !tile.imageBitmap) return;
    
    // TODO: Upload tile to WebGL texture
    // Use texImage2D or texSubImage2D
  }

  destroy(): void {
    super.destroy();
    
    if (this.gl) {
      // Clean up WebGL resources
      // TODO: Delete textures, buffers, programs
    }
    
    this.gl = null;
  }
}
