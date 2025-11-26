/**
 * TIFF tile source for tiled TIFF images
 * Handles reading individual tiles from tiled TIFF files
 * 
 * Supports multiple compression types:
 * - None (1)
 * - LZW (5)
 * - JPEG (7)
 * - Deflate (8, 32946)
 * - PackBits (32773)
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from './base-source.js';
import UTIF from 'utif';
import {
  TIFFCompression,
  isCompressionSupported,
  getCompressionName,
  decompressData,
  applyPredictor,
  decodeJPEGTile,
  decodeToRGBA,
} from '../tiff/compression.js';

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
  /** Compression type (from tag 259, default: 1 = None) */
  compression?: number;
  /** Photometric interpretation (from tag 262, default: 2 = RGB) */
  photometric?: number;
  /** Samples per pixel (from tag 277, default: 3) */
  samplesPerPixel?: number;
  /** Bits per sample (from tag 258, default: 8) */
  bitsPerSample?: number | number[];
  /** Predictor (from tag 317, default: 1 = none) */
  predictor?: number;
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
  
  // Compression and color settings
  private compression: number;
  private photometric: number;
  private samplesPerPixel: number;
  private bitsPerSample: number | number[];
  private predictor: number;

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
    
    // Compression settings with defaults
    this.compression = options.compression ?? TIFFCompression.None;
    this.photometric = options.photometric ?? 2; // RGB
    this.samplesPerPixel = options.samplesPerPixel ?? 3;
    this.bitsPerSample = options.bitsPerSample ?? 8;
    this.predictor = options.predictor ?? 1;
    
    // Log tile source summary
    const compressionInfo = this.compression !== TIFFCompression.None 
      ? `, ${getCompressionName(this.compression)}${!isCompressionSupported(this.compression) ? ' ⚠️' : ''}`
      : '';
    console.info(`[TIFF] 🖼️ ${this.width}×${this.height} | ${this.tilesAcross}×${this.tilesDown} tiles (${this.tileWidth}×${this.tileHeight} each)${compressionInfo}`);
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

      if (tileOffset === undefined || tileByteCount === undefined) {
        console.warn(`[TIFFTileSource] Missing offset/count for tile ${x},${y}`);
        return null;
      }

      if (tileOffset === 0 || tileByteCount === 0) {
        return null; // Empty tile
      }

      if (tileOffset + tileByteCount > this.arrayBuffer.byteLength) {
        console.warn(`[TIFFTileSource] Tile ${x},${y} offset out of bounds`);
        return null;
      }

      // Get tile dimensions (may be smaller at edges)
      const tileX = x * this.tileWidth;
      const tileY = y * this.tileHeight;
      const actualTileWidth = Math.min(this.tileWidth, this.width - tileX);
      const actualTileHeight = Math.min(this.tileHeight, this.height - tileY);

      // Extract tile data
      const tileData = new Uint8Array(
        this.arrayBuffer,
        tileOffset,
        tileByteCount
      );

      try {
        let rgbaData: Uint8ClampedArray;
        
        // Handle JPEG compression specially
        if (this.compression === TIFFCompression.JPEG) {
          const decoded = await decodeJPEGTile(tileData, actualTileWidth, actualTileHeight);
          rgbaData = decoded.data;
        } else {
          // For other compressions, use UTIF first, then fallback to manual decompression
          let useManualDecompression = false;
          let decodedData: Uint8Array | null = null;
          
          // Try UTIF first for LZW and uncompressed
          if (this.compression === TIFFCompression.None || this.compression === TIFFCompression.LZW) {
            try {
              const slicedData = this.arrayBuffer.slice(tileOffset, tileOffset + tileByteCount);
              const ifds = UTIF.decode(slicedData);
              
              if (ifds && ifds.length > 0) {
                const ifd = ifds[0];
                if (ifd) {
                  UTIF.decodeImage(slicedData, ifd);
                  
                  if (ifd.data) {
                    // UTIF decoded successfully
                    const ifdData = ifd.data as any;
                    
                    if (ifdData instanceof Uint8Array) {
                      decodedData = ifdData;
                    } else if (ifdData instanceof Uint8ClampedArray) {
                      decodedData = new Uint8Array(ifdData);
                    } else if (ifdData instanceof Uint16Array) {
                      decodedData = new Uint8Array(ifdData.length);
                      for (let i = 0; i < ifdData.length; i++) {
                        const val = ifdData[i];
                        decodedData[i] = Math.min(255, Math.floor(((val ?? 0) / 65535) * 255));
                      }
                    } else if (ifdData.buffer) {
                      decodedData = new Uint8Array(ifdData.buffer, 0, ifdData.length ?? ifdData.byteLength ?? 0);
                    } else {
                      decodedData = new Uint8Array(ifdData);
                    }
                  }
                }
              }
            } catch (utifError) {
              console.debug(`[TIFFTileSource] UTIF decode failed for tile ${x},${y}, trying manual:`, utifError);
              useManualDecompression = true;
            }
          } else {
            // Use manual decompression for other compression types
            useManualDecompression = true;
          }
          
          // Manual decompression fallback
          if (useManualDecompression || !decodedData) {
            try {
              const expectedSize = this.tileWidth * this.tileHeight * this.samplesPerPixel;
              decodedData = await decompressData(tileData, this.compression, expectedSize);
              
              // Apply predictor if needed
              if (this.predictor > 1 && decodedData) {
                decodedData = applyPredictor(
                  decodedData,
                  actualTileWidth,
                  actualTileHeight,
                  this.samplesPerPixel,
                  this.predictor
                );
              }
            } catch (decompressError) {
              console.error(`[TIFFTileSource] Decompression failed for tile ${x},${y}:`, decompressError);
              return null;
            }
          }
          
          if (!decodedData) {
            console.warn(`[TIFFTileSource] No decoded data for tile ${x},${y}`);
            return null;
          }
          
          // Convert to RGBA
          rgbaData = decodeToRGBA(
            decodedData,
            actualTileWidth,
            actualTileHeight,
            this.samplesPerPixel,
            this.bitsPerSample,
            this.photometric
          );
        }

        // Create ImageBitmap from RGBA data
        // Ensure the data is a plain Uint8ClampedArray with ArrayBuffer (not SharedArrayBuffer)
        const bufferCopy = rgbaData.slice().buffer as ArrayBuffer;
        const imageDataArray = new Uint8ClampedArray(bufferCopy);
        const imageData = new ImageData(imageDataArray, actualTileWidth, actualTileHeight);
        const canvas = new OffscreenCanvas(actualTileWidth, actualTileHeight);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error(`[TIFFTileSource] Failed to get canvas context for tile ${x},${y}`);
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

  /**
   * Get compression type
   */
  getCompression(): number {
    return this.compression;
  }

  /**
   * Check if compression is supported
   */
  isCompressionSupported(): boolean {
    return isCompressionSupported(this.compression);
  }

  destroy(): void {
    // Close all cached ImageBitmaps
    for (const bitmap of this.tileCache.values()) {
      bitmap.close();
    }
    this.tileCache.clear();
  }
}
