/**
 * In-memory tile source for pre-loaded images
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from './base-source.js';

/**
 * Memory tile source options
 */
export interface MemoryTileSourceOptions {
  /** Image data (ImageBitmap, ImageData, or ArrayBuffer) */
  imageData: ImageBitmap | ImageData | ArrayBuffer;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Tile size */
  tileSize?: number;
  /** Number of pyramid levels */
  levelCount?: number;
  /** MIME type (for ArrayBuffer) */
  mimeType?: string;
}

/**
 * In-memory tile source
 */
export class MemoryTileSource extends BaseTileSource {
  private imageData: ImageBitmap | ImageData | ArrayBuffer;
  private width: number;
  private height: number;
  private levelCountValue: number;
  private mimeType?: string;
  private imageBitmap: ImageBitmap | null = null;

  constructor(options: MemoryTileSourceOptions) {
    super(options.tileSize);
    this.imageData = options.imageData;
    this.width = options.width;
    this.height = options.height;
    this.levelCountValue = options.levelCount ?? 1;
    this.mimeType = options.mimeType;
    
    // If already an ImageBitmap, use it directly
    if (this.imageData instanceof ImageBitmap) {
      this.imageBitmap = this.imageData;
    }
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    if (level >= this.levelCountValue) {
      return null;
    }

    // For MemoryTileSource, return the entire image as a single tile
    // This handles the case where the image is small enough to fit in one tile
    // or when we want to display the full image regardless of tile coordinates
    // Only return tile at level 0 (other levels would require downscaling)
    if (level !== 0) {
      return null;
    }
    
    // Return the full image for any tile coordinate request at level 0
    // The renderer will handle clipping to the viewport

    // Convert ArrayBuffer to ImageBitmap if needed
    if (!this.imageBitmap) {
      if (this.imageData instanceof ArrayBuffer) {
        // Check if this is a TIFF file (browsers don't support TIFF decoding)
        const isTIFF = this.mimeType === 'image/tiff' || this.mimeType === 'image/tif';
        
        if (isTIFF) {
          // Try to detect TIFF magic bytes
          const view = new DataView(this.imageData);
          if (this.imageData.byteLength >= 4) {
            const byte0 = view.getUint8(0);
            const byte1 = view.getUint8(1);
            const isTIFFFile = (byte0 === 0x49 && byte1 === 0x49) || (byte0 === 0x4d && byte1 === 0x4d);
            
            if (isTIFFFile) {
              throw new Error(
                'TIFF files cannot be decoded directly in the browser. ' +
                'TIFF decoding requires a JavaScript decoder library (e.g., tiff.js). ' +
                'Full TIFF parsing support is planned for future releases.'
              );
            }
          }
        }
        
        try {
          const blob = new Blob([this.imageData], { type: this.mimeType || 'image/png' });
          this.imageBitmap = await createImageBitmap(blob);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (isTIFF) {
            throw new Error(
              `TIFF decoding failed: ${errorMessage}. ` +
              'Browsers do not natively support TIFF format. ' +
              'Please use a TIFF decoder library or convert the image to a supported format (PNG, JPEG).'
            );
          }
          console.error('Failed to create ImageBitmap from ArrayBuffer:', error);
          throw error;
        }
      } else if (this.imageData instanceof ImageData) {
        // Convert ImageData to ImageBitmap
        try {
          const canvas = new OffscreenCanvas(this.imageData.width, this.imageData.height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.putImageData(this.imageData, 0, 0);
            this.imageBitmap = await createImageBitmap(canvas);
          }
        } catch (error) {
          console.error('Failed to create ImageBitmap from ImageData:', error);
          return null;
        }
      }
    }

    if (!this.imageBitmap) {
      return null;
    }

    return {
      level: 0,
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      imageX: 0,
      imageY: 0,
      imageBitmap: this.imageBitmap,
      loaded: true,
      visible: false,
      lastAccess: Date.now(),
    };
  }

  async getImageSize(): Promise<[number, number]> {
    return [this.width, this.height];
  }

  async getLevelCount(): Promise<number> {
    return this.levelCountValue;
  }

  destroy(): void {
    // Only close if we created the ImageBitmap ourselves
    if (this.imageBitmap && this.imageData instanceof ArrayBuffer) {
      this.imageBitmap.close();
      this.imageBitmap = null;
    }
  }
}

