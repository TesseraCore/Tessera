/**
 * HTTP-based tile source
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from './base-source.js';

/**
 * HTTP tile source options
 */
export interface HTTPTileSourceOptions {
  /** Base URL for tiles */
  baseUrl: string;
  /** Tile size */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** URL template function */
  getTileUrl: (level: number, x: number, y: number) => string;
  /** Get image dimensions */
  getImageSize: () => Promise<[number, number]>;
  /** Get level count */
  getLevelCount: () => Promise<number>;
}

/**
 * HTTP-based tile source
 */
export class HTTPTileSource extends BaseTileSource {
  private headers?: Record<string, string>;
  private getTileUrlFn: (level: number, x: number, y: number) => string;
  private getImageSizeFn: () => Promise<[number, number]>;
  private getLevelCountFn: () => Promise<number>;

  constructor(options: HTTPTileSourceOptions) {
    super(options.tileSize);
    this.headers = options.headers;
    this.getTileUrlFn = options.getTileUrl;
    this.getImageSizeFn = options.getImageSize;
    this.getLevelCountFn = options.getLevelCount;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    const url = this.getTileUrlFn(level, x, y);
    
    try {
      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      
      const [imageWidth, imageHeight] = await this.getImageSize();
      const levelCount = await this.getLevelCount();
      const scale = Math.pow(2, levelCount - 1 - level);
      
      const tileX = x * this.tileSize;
      const tileY = y * this.tileSize;
      const levelWidth = Math.ceil(imageWidth * scale);
      const levelHeight = Math.ceil(imageHeight * scale);
      
      const tileWidth = Math.min(this.tileSize, levelWidth - tileX);
      const tileHeight = Math.min(this.tileSize, levelHeight - tileY);

      return {
        level,
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        imageX: Math.floor(tileX / scale),
        imageY: Math.floor(tileY / scale),
        imageBitmap,
        loaded: true,
        visible: false,
        lastAccess: Date.now(),
      };
    } catch (error) {
      console.error(`Failed to load tile ${level}/${x}/${y}:`, error);
      return null;
    }
  }

  getTileUrl(level: number, x: number, y: number): string {
    return this.getTileUrlFn(level, x, y);
  }

  async getImageSize(): Promise<[number, number]> {
    return this.getImageSizeFn();
  }

  async getLevelCount(): Promise<number> {
    return this.getLevelCountFn();
  }
}

