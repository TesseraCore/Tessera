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
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  renderTiles(tiles: Tile[], view: ViewUniforms): void {
    if (!this.ctx) return;
    
    // Save context state
    this.ctx.save();
    
    // Apply view transform
    const m = view.viewMatrix;
    const m00 = m[0] ?? 0;
    const m01 = m[1] ?? 0;
    const m02 = m[2] ?? 0;
    const m10 = m[3] ?? 0;
    const m11 = m[4] ?? 0;
    const m12 = m[5] ?? 0;
    
    this.ctx.setTransform(m00, m10, m01, m11, m02, m12);
    
    // Render tiles
    for (const tile of tiles) {
      if (!tile.imageBitmap) continue;
      
      this.ctx.drawImage(
        tile.imageBitmap,
        tile.imageX,
        tile.imageY,
        tile.width,
        tile.height
      );
    }
    
    // Restore context state
    this.ctx.restore();
  }

  renderAnnotations(batch: AnnotationBatch, view: ViewUniforms): void {
    if (!this.ctx) return;
    
    // TODO: Implement annotation rendering with Canvas2D
    // Draw paths, shapes, text, etc.
  }

  renderOverlays(overlays: Overlay[], view: ViewUniforms): void {
    if (!this.ctx) return;
    
    // TODO: Implement overlay rendering
    // Draw UI elements, handles, previews, etc.
  }

  async uploadTile(tile: Tile): Promise<void> {
    // Canvas2D doesn't need explicit upload
    // ImageBitmap can be drawn directly
    return Promise.resolve();
  }

  destroy(): void {
    super.destroy();
    this.ctx = null;
  }
}
