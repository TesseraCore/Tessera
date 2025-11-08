/**
 * Tile source interface and implementations
 */

import type { Tile } from '../backend/types.js';

/**
 * Tile source interface for loading tiles from various formats
 */
export interface TileSource {
  /** Get a tile by coordinates */
  getTile(level: number, x: number, y: number): Promise<Tile | null>;
  
  /** Get tile URL (for HTTP sources) */
  getTileUrl?(level: number, x: number, y: number): string;
  
  /** Get image dimensions */
  getImageSize(): Promise<[number, number]>;
  
  /** Get number of pyramid levels */
  getLevelCount(): Promise<number>;
  
  /** Get tile size for a level */
  getTileSize(level: number): Promise<[number, number]>;
  
  /** Destroy the source and clean up */
  destroy?(): void;
}

/**
 * Tile source options
 */
export interface TileSourceOptions {
  /** Base URL for tile sources */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Image format */
  format?: 'tiff' | 'zarr' | 'dicom' | 'iiif' | 'jpeg' | 'png';
  /** Custom headers */
  headers?: Record<string, string>;
}
