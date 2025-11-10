/**
 * TIFF tile source for tiled TIFF images
 * Handles reading individual tiles from tiled TIFF files
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from './base-source.js';
import UTIF from 'utif';

/**
 * TIFF tile source options
 */
export interface TIFFTileSourceOptions {
  /** TIFF file data as ArrayBuffer */
  arrayBuffer: ArrayBuffer;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Tile width (from TIFF tag 322) */
  tileWidth: number;
  /** Tile height (from TIFF tag 323) */
  tileHeight: number;
  /** Tile offsets (from TIFF tag 324) */
  tileOffsets: number[];
  /** Tile byte counts (from TIFF tag 325) */
  tileByteCounts: number[];
  /** Number of tiles per row */
  tilesAcross: number;
  /** Number of tiles per column */
  tilesDown: number;
}

/**
 * TIFF tile source for tiled TIFF images
 */
export class TIFFTileSource extends BaseTileSource {
  private arrayBuffer: ArrayBuffer;
  private width: number;
  private height: number;
  private tileWidth: number;
  private tileHeight: number;
  private tileOffsets: number[];
  private tileByteCounts: number[];
  private tilesAcross: number;
  private tilesDown: number;
  private tileCache = new Map<string, ImageBitmap>();

  constructor(options: TIFFTileSourceOptions) {
    super(Math.max(options.tileWidth, options.tileHeight));
    this.arrayBuffer = options.arrayBuffer;
    this.width = options.width;
    this.height = options.height;
    this.tileWidth = options.tileWidth;
    this.tileHeight = options.tileHeight;
    this.tileOffsets = options.tileOffsets;
    this.tileByteCounts = options.tileByteCounts;
    this.tilesAcross = options.tilesAcross;
    this.tilesDown = options.tilesDown;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    if (level !== 0) {
      // Only support level 0 for now
      return null;
    }

    // Validate tile coordinates
    if (x < 0 || x >= this.tilesAcross || y < 0 || y >= this.tilesDown) {
      return null;
    }

    // Calculate tile index
    const tileIndex = y * this.tilesAcross + x;
    if (tileIndex >= this.tileOffsets.length) {
      return null;
    }

    // Check cache
    const cacheKey = `${level}:${x}:${y}`;
    let imageBitmap = this.tileCache.get(cacheKey);

    if (!imageBitmap) {
      // Extract tile data from TIFF
      const tileOffset = this.tileOffsets[tileIndex];
      const tileByteCount = this.tileByteCounts[tileIndex];

      if (tileOffset === 0 || tileByteCount === 0) {
        return null; // Empty tile
      }

      if (tileOffset + tileByteCount > this.arrayBuffer.byteLength) {
        console.warn(`[TIFFTileSource] Tile ${x},${y} offset out of bounds`);
        return null;
      }

      // Extract tile data
      const tileData = this.arrayBuffer.slice(tileOffset, tileOffset + tileByteCount);

      // Decode tile using UTIF
      try {
        const ifds = UTIF.decode(tileData);
        if (!ifds || ifds.length === 0) {
          console.warn(`[TIFFTileSource] Failed to decode tile ${x},${y}`);
          return null;
        }

        const ifd = ifds[0];
        UTIF.decodeImage(tileData, ifd);

        if (!ifd.data) {
          console.warn(`[TIFFTileSource] No data in tile ${x},${y}`);
          return null;
        }

        // Get tile dimensions (may be smaller at edges)
        const tileX = x * this.tileWidth;
        const tileY = y * this.tileHeight;
        const actualTileWidth = Math.min(this.tileWidth, this.width - tileX);
        const actualTileHeight = Math.min(this.tileHeight, this.height - tileY);

        // Convert decoded tile data to ImageBitmap
        const totalPixels = actualTileWidth * actualTileHeight;
        const dataLength = ifd.data.length;
        const bytesPerPixel = dataLength / totalPixels;

        if (bytesPerPixel < 1 || bytesPerPixel > 4) {
          console.warn(`[TIFFTileSource] Invalid bytes per pixel for tile ${x},${y}: ${bytesPerPixel}`);
          return null;
        }

        // Convert to RGBA
        const rgbaData = new Uint8ClampedArray(totalPixels * 4);
        let sourceData: Uint8Array;

        if (ifd.data instanceof Uint8Array || ifd.data instanceof Uint8ClampedArray) {
          sourceData = ifd.data;
        } else if (ifd.data instanceof Uint16Array) {
          sourceData = new Uint8Array(ifd.data.length);
          for (let i = 0; i < ifd.data.length; i++) {
            sourceData[i] = Math.min(255, Math.floor((ifd.data[i] / 65535) * 255));
          }
        } else {
          const buffer = ifd.data.buffer || ifd.data;
          sourceData = new Uint8Array(buffer, 0, dataLength);
        }

        // Convert to RGBA format
        const bpp = Math.round(bytesPerPixel);
        if (bpp === 1) {
          // Grayscale
          for (let i = 0; i < totalPixels; i++) {
            const gray = sourceData[i];
            rgbaData[i * 4] = gray;
            rgbaData[i * 4 + 1] = gray;
            rgbaData[i * 4 + 2] = gray;
            rgbaData[i * 4 + 3] = 255;
          }
        } else if (bpp === 2) {
          // Grayscale + Alpha
          for (let i = 0; i < totalPixels; i++) {
            const gray = sourceData[i * 2];
            const alpha = sourceData[i * 2 + 1];
            rgbaData[i * 4] = gray;
            rgbaData[i * 4 + 1] = gray;
            rgbaData[i * 4 + 2] = gray;
            rgbaData[i * 4 + 3] = alpha;
          }
        } else if (bpp === 3) {
          // RGB
          for (let i = 0; i < totalPixels; i++) {
            rgbaData[i * 4] = sourceData[i * 3];
            rgbaData[i * 4 + 1] = sourceData[i * 3 + 1];
            rgbaData[i * 4 + 2] = sourceData[i * 3 + 2];
            rgbaData[i * 4 + 3] = 255;
          }
        } else if (bpp === 4) {
          // RGBA
          rgbaData.set(sourceData.subarray(0, totalPixels * 4));
        }

        const imageData = new ImageData(rgbaData, actualTileWidth, actualTileHeight);
        const canvas = new OffscreenCanvas(actualTileWidth, actualTileHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return null;
        }

        ctx.putImageData(imageData, 0, 0);
        imageBitmap = await createImageBitmap(canvas);

        // Cache the tile
        this.tileCache.set(cacheKey, imageBitmap);
      } catch (error) {
        console.error(`[TIFFTileSource] Error decoding tile ${x},${y}:`, error);
        return null;
      }
    }

    // Calculate tile position in image space
    const imageX = x * this.tileWidth;
    const imageY = y * this.tileHeight;
    const actualTileWidth = Math.min(this.tileWidth, this.width - imageX);
    const actualTileHeight = Math.min(this.tileHeight, this.height - imageY);

    return {
      level: 0,
      x,
      y,
      width: actualTileWidth,
      height: actualTileHeight,
      imageX,
      imageY,
      imageBitmap,
      loaded: true,
      visible: false,
      lastAccess: Date.now(),
    };
  }

  async getImageSize(): Promise<[number, number]> {
    return [this.width, this.height];
  }

  async getLevelCount(): Promise<number> {
    return 1; // Only support single level for now
  }

  async getTileSize(_level: number): Promise<[number, number]> {
    return [this.tileWidth, this.tileHeight];
  }

  destroy(): void {
    // Close all cached ImageBitmaps
    for (const bitmap of this.tileCache.values()) {
      bitmap.close();
    }
    this.tileCache.clear();
  }
}

