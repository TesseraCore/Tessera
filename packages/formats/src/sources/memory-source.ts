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
}

/**
 * In-memory tile source
 */
export class MemoryTileSource extends BaseTileSource {
  private width: number;
  private height: number;
  private levelCountValue: number;

  constructor(options: MemoryTileSourceOptions) {
    super(options.tileSize);
    this.width = options.width;
    this.height = options.height;
    this.levelCountValue = options.levelCount ?? 1;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    if (level >= this.levelCountValue) {
      return null;
    }

    const scale = Math.pow(2, this.levelCountValue - 1 - level);
    const levelWidth = Math.ceil(this.width * scale);
    const levelHeight = Math.ceil(this.height * scale);
    
    const tileX = x * this.tileSize;
    const tileY = y * this.tileSize;
    
    if (tileX >= levelWidth || tileY >= levelHeight) {
      return null;
    }

    const tileWidth = Math.min(this.tileSize, levelWidth - tileX);
    const tileHeight = Math.min(this.tileSize, levelHeight - tileY);

    // For now, return a placeholder tile
    // Full implementation would extract the tile from imageData
    return {
      level,
      x,
      y,
      width: tileWidth,
      height: tileHeight,
      imageX: Math.floor(tileX / scale),
      imageY: Math.floor(tileY / scale),
      loaded: false,
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
}

