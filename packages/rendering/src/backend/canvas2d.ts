/**
 * Canvas2D rendering backend (universal fallback)
 */

import { BaseBackend } from './base.js';
import type { Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

/**
 * Canvas2D rendering backend
 * Universal fallback when GPU is not available
 */
export class Canvas2DBackend extends BaseBackend {
  private ctx: CanvasRenderingContext2D | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error('Canvas2D is not supported');
    }

    this.ctx = ctx;
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.initialized = true;

    // Set up Canvas2D state
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  resize(width: number, height: number): void {
    super.resize(width, height);
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    
    // Fill with dark background color instead of clearing to transparent
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  renderTiles(tiles: Tile[], view: ViewUniforms): void {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas before rendering
    this.clear();
    
    // Save context state
    this.ctx.save();
    
    // Apply view transform
    // Our view matrix is a 3x3 affine matrix stored as:
    // [m00, m01, m02, m10, m11, m12, m20, m21, m22]
    // Which represents:
    // [m00 m01 m02]   [a c e]
    // [m10 m11 m12] = [b d f]
    // [m20 m21 m22]   [0 0 1]
    //
    // Canvas2D setTransform expects: (a, b, c, d, e, f)
    const m = view.viewMatrix;
    const a = m[0] ?? 1;   // m00 - horizontal scaling
    const c = m[1] ?? 0;   // m01 - horizontal skewing
    const e = m[2] ?? 0;   // m02 - horizontal translation
    const b = m[3] ?? 0;   // m10 - vertical skewing
    const d = m[4] ?? 1;   // m11 - vertical scaling
    const f = m[5] ?? 0;   // m12 - vertical translation
    
    this.ctx.setTransform(a, b, c, d, e, f);
    
    // Render tiles
    let renderedCount = 0;
    for (const tile of tiles) {
      if (!tile.imageBitmap) {
        continue;
      }
      
      try {
        // Draw tile at its image-space position
        // The view transform will convert this to screen space
        this.ctx.drawImage(
          tile.imageBitmap,
          tile.imageX,
          tile.imageY,
          tile.width,
          tile.height
        );
        renderedCount++;
      } catch (error) {
        console.error(`[Canvas2D] Error drawing tile (${tile.x}, ${tile.y}):`, error);
      }
    }
    
    // Restore context state
    this.ctx.restore();
  }

  renderAnnotations(_batch: AnnotationBatch, _view: ViewUniforms): void {
    if (!this.ctx) return;
    
    // TODO: Implement annotation rendering with Canvas2D
    // Draw paths, shapes, text, etc.
  }

  renderOverlays(_overlays: Overlay[], _view: ViewUniforms): void {
    if (!this.ctx) return;
    
    // TODO: Implement overlay rendering
    // Draw UI elements, handles, previews, etc.
  }

  async uploadTile(_tile: Tile): Promise<void> {
    // Canvas2D doesn't need explicit upload
    // ImageBitmap can be drawn directly
    return Promise.resolve();
  }

  destroy(): void {
    if (super.destroy) {
      super.destroy();
    }
    this.ctx = null;
  }
}
