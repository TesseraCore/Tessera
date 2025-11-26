/**
 * Base rendering backend implementation
 */

import type { RenderBackend, Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

/**
 * Base backend class with common functionality
 */
export abstract class BaseBackend implements RenderBackend {
  protected canvas: HTMLCanvasElement | null = null;
  protected width = 0;
  protected height = 0;
  protected initialized = false;

  abstract init(canvas: HTMLCanvasElement): Promise<void>;
  
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  clear(): void {
    // Default implementation - subclasses should override
  }

  renderTiles?(_tiles: Tile[], _view: ViewUniforms): void {
    // Default implementation - subclasses should override
  }

  renderAnnotations?(_batch: AnnotationBatch, _view: ViewUniforms): void {
    // Default implementation - subclasses should override
  }

  renderOverlays?(_overlays: Overlay[], _view: ViewUniforms): void {
    // Default implementation - subclasses should override
  }

  uploadTile?(_tile: Tile): Promise<void> {
    // Default implementation - subclasses should override
    return Promise.resolve();
  }

  destroy?(): void {
    this.canvas = null;
    this.initialized = false;
  }
}

