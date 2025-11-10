/**
 * WebGPU rendering backend
 */

import { BaseBackend } from './base.js';
import type { Tile, AnnotationBatch, Overlay, ViewUniforms } from './types.js';

/**
 * WebGPU rendering backend
 */
export class WebGPUBackend extends BaseBackend {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat | null = null;
  private commandEncoder: GPUCommandEncoder | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check WebGPU support
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      throw new Error('WebGPU is not supported');
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter');
    }

    this.device = await adapter.requestDevice();
    this.canvas = canvas;
    
    // Get WebGPU context
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to get WebGPU context');
    }
    
    this.context = context;
    this.format = (navigator as any).gpu.getPreferredCanvasFormat();
    
    // Configure canvas with proper usage flags
    await this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.width = canvas.width;
    this.height = canvas.height;
    this.initialized = true;
  }

  resize(width: number, height: number): void {
    super.resize(width, height);
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    // Reconfigure context if needed
    if (this.context && this.device && this.format) {
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
  }

  clear(): void {
    if (!this.context || !this.device) return;
    
    // Don't clear if we're about to render tiles - the renderTiles will overwrite anyway
    // This prevents clearing from overwriting the rendered content
    // We'll let renderTiles handle the background
    
    // If we really need to clear, we can do it, but it might interfere with rendering
    // For now, skip clearing to avoid overwriting rendered tiles
    return;
  }

  async renderTiles(tiles: Tile[], view: ViewUniforms): Promise<void> {
    if (!this.device || !this.context) {
      console.warn('[WebGPU] Device or context not available');
      return;
    }
    
    if (tiles.length === 0) {
      console.warn('[WebGPU] No tiles to render');
      return;
    }
    
    // Temporary implementation: Use Canvas2D to render tiles, then copy to WebGPU
    // This is a fallback until full WebGPU tile rendering is implemented
    const canvas2d = document.createElement('canvas');
    canvas2d.width = this.canvas.width;
    canvas2d.height = this.canvas.height;
    const ctx = canvas2d.getContext('2d');
    
    if (!ctx) {
      console.error('[WebGPU] Failed to get 2D context');
      return;
    }
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);
    
    // Apply view transform
    const m = view.viewMatrix;
    const m00 = m[0] ?? 0;
    const m01 = m[1] ?? 0;
    const m02 = m[2] ?? 0;
    const m10 = m[3] ?? 0;
    const m11 = m[4] ?? 0;
    const m12 = m[5] ?? 0;
    
    // Apply view transform (currently drawing centered, will use transform later)
    
    // For now, let's try drawing without transform to see if tiles render
    // Then we can debug the transform separately
    ctx.save();
    ctx.resetTransform();
    
    // Render tiles
    let renderedCount = 0;
    for (const tile of tiles) {
      if (!tile.imageBitmap) {
        console.warn(`[WebGPU] Tile ${tile.level}/${tile.x}/${tile.y} has no imageBitmap`);
        continue;
      }
      
      try {
        // Calculate position and scale
        const scaleX = canvas2d.width / tile.width;
        const scaleY = canvas2d.height / tile.height;
        const scale = Math.min(scaleX, scaleY);
        
        const drawWidth = tile.width * scale;
        const drawHeight = tile.height * scale;
        const drawX = (canvas2d.width - drawWidth) / 2;
        const drawY = (canvas2d.height - drawHeight) / 2;
        
        // Ensure we're drawing within canvas bounds
        const clampedX = Math.max(0, Math.min(drawX, canvas2d.width));
        const clampedY = Math.max(0, Math.min(drawY, canvas2d.height));
        const clampedWidth = Math.min(drawWidth, canvas2d.width - clampedX);
        const clampedHeight = Math.min(drawHeight, canvas2d.height - clampedY);
        
        // Convert ImageBitmap to ImageData for reliable drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tile.imageBitmap.width;
        tempCanvas.height = tile.imageBitmap.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        if (!tempCtx) {
          throw new Error('Failed to get 2D context for temporary canvas');
        }
        
        // Draw ImageBitmap to temporary canvas
        tempCtx.drawImage(tile.imageBitmap, 0, 0);
        
        // Get ImageData from the temp canvas
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Verify we got content
        const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val > 10);
        if (!hasContent) {
          console.warn(`[WebGPU] ImageBitmap produced empty ImageData, skipping tile`);
          continue;
        }
        
        // Scale the ImageData to the target size
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = clampedWidth;
        scaledCanvas.height = clampedHeight;
        const scaledCtx = scaledCanvas.getContext('2d', { willReadFrequently: false });
        
        if (scaledCtx) {
          // Draw the temp canvas to the scaled canvas
          scaledCtx.drawImage(tempCanvas, 0, 0, clampedWidth, clampedHeight);
          
          // Get the scaled ImageData
          const scaledImageData = scaledCtx.getImageData(0, 0, clampedWidth, clampedHeight);
          
          // Use putImageData to draw directly to the render canvas
          ctx.putImageData(scaledImageData, clampedX, clampedY);
        } else {
          // Fallback: draw the temp canvas directly
          ctx.drawImage(tempCanvas, clampedX, clampedY, clampedWidth, clampedHeight);
        }
        
        renderedCount++;
      } catch (drawError) {
        console.error(`[WebGPU] Error drawing tile ${tile.level}/${tile.x}/${tile.y}:`, drawError);
      }
    }
    
    ctx.restore();
    
    // Copy Canvas2D result to WebGPU texture
    const texture = this.context.getCurrentTexture();
    
    // Copy the canvas to WebGPU texture
    try {
      const imageBitmap = await createImageBitmap(canvas2d);
      const bitmapWidth = imageBitmap.width;
      const bitmapHeight = imageBitmap.height;
      
      this.device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture },
        { width: bitmapWidth, height: bitmapHeight }
      );
      
      imageBitmap.close();
    } catch (error) {
      console.error('[WebGPU] Error copying canvas to texture:', error);
      // Fallback: try direct canvas copy
      try {
        this.device.queue.copyExternalImageToTexture(
          { source: canvas2d },
          { texture },
          { width: canvas2d.width, height: canvas2d.height }
        );
      } catch (canvasError) {
        console.error('[WebGPU] Canvas copy also failed:', canvasError);
      }
    }
  }

  renderAnnotations(batch: AnnotationBatch, view: ViewUniforms): void {
    if (!this.device || !this.context) return;
    
    // TODO: Implement annotation rendering
  }

  renderOverlays(overlays: Overlay[], view: ViewUniforms): void {
    if (!this.device || !this.context) return;
    
    // TODO: Implement overlay rendering
  }

  async uploadTile(tile: Tile): Promise<void> {
    if (!this.device || !tile.imageBitmap) return;
    
    // TODO: Upload tile to GPU texture
    // Use copyExternalImageToTexture for efficient upload
  }

  destroy(): void {
    super.destroy();
    this.device = null;
    this.context = null;
    this.format = null;
    this.commandEncoder = null;
  }
}
