/**
 * Tile manager for loading and caching tiles
 */

import type { Tile, ViewUniforms } from '../backend/types.js';
import type { TileSource } from './source.js';
import { TileCache } from './cache.js';

/**
 * Tile manager options
 */
export interface TileManagerOptions {
  /** Tile source */
  source: TileSource;
  /** Cache options */
  cache?: import('./cache.js').CacheOptions;
  /** Maximum concurrent tile loads */
  maxConcurrentLoads?: number;
}

/**
 * Tile manager for loading and managing tiles
 */
export class TileManager {
  private source: TileSource;
  private cache: TileCache;
  private loadingTiles = new Set<string>();
  private loadingQueue: Array<{ level: number; x: number; y: number }> = [];
  private activeLoads = 0;
  private maxConcurrentLoads: number;
  private imageSize: [number, number] | null = null;
  private levelCount = 0;

  constructor(options: TileManagerOptions) {
    this.source = options.source;
    this.cache = new TileCache(options.cache);
    this.maxConcurrentLoads = options.maxConcurrentLoads ?? 4;
    
    this.init();
  }

  /**
   * Initialize tile manager
   */
  private async init(): Promise<void> {
    try {
      this.imageSize = await this.source.getImageSize();
      this.levelCount = await this.source.getLevelCount();
    } catch (error) {
      console.error('Failed to initialize tile manager:', error);
    }
  }

  /**
   * Get image dimensions
   */
  getImageSize(): [number, number] | null {
    return this.imageSize;
  }

  /**
   * Get visible tiles for current viewport
   */
  async getVisibleTiles(view: ViewUniforms): Promise<Tile[]> {
    if (!this.imageSize) {
      return [];
    }

    const [imageWidth, imageHeight] = this.imageSize;
    const [viewportWidth, viewportHeight] = view.viewportSize;
    
    // Calculate visible region in image space
    // This is a simplified version - full implementation would use quadtree
    const zoom = this.estimateZoom(view);
    const level = this.selectLevel(zoom);
    
    // Calculate tile grid bounds
    const tileSize = await this.source.getTileSize(level);
    const [tileWidth, tileHeight] = tileSize;
    
    // Convert viewport to image coordinates
    const invMatrix = view.invViewMatrix;
    const m00 = invMatrix[0] ?? 0;
    const m01 = invMatrix[1] ?? 0;
    const m02 = invMatrix[2] ?? 0;
    const m10 = invMatrix[3] ?? 0;
    const m11 = invMatrix[4] ?? 0;
    const m12 = invMatrix[5] ?? 0;
    
    // Get viewport corners in image space
    const topLeft = [m00 * 0 + m01 * 0 + m02, m10 * 0 + m11 * 0 + m12];
    const topRight = [m00 * viewportWidth + m01 * 0 + m02, m10 * viewportWidth + m11 * 0 + m12];
    const bottomLeft = [m00 * 0 + m01 * viewportHeight + m02, m10 * 0 + m11 * viewportHeight + m12];
    const bottomRight = [m00 * viewportWidth + m01 * viewportHeight + m02, m10 * viewportWidth + m11 * viewportHeight + m12];
    
    // Find bounding box
    const minX = Math.min(topLeft[0]!, topRight[0]!, bottomLeft[0]!, bottomRight[0]!);
    const maxX = Math.max(topLeft[0]!, topRight[0]!, bottomLeft[0]!, bottomRight[0]!);
    const minY = Math.min(topLeft[1]!, topRight[1]!, bottomLeft[1]!, bottomRight[1]!);
    const maxY = Math.max(topLeft[1]!, topRight[1]!, bottomLeft[1]!, bottomRight[1]!);
    
    // Clamp to image bounds
    const clampedMinX = Math.max(0, Math.floor(minX / tileWidth));
    const clampedMaxX = Math.min(Math.ceil(imageWidth / tileWidth), Math.ceil(maxX / tileWidth));
    const clampedMinY = Math.max(0, Math.floor(minY / tileHeight));
    const clampedMaxY = Math.min(Math.ceil(imageHeight / tileHeight), Math.ceil(maxY / tileHeight));
    
    // Collect visible tiles
    const visibleTiles: Tile[] = [];
    
    for (let y = clampedMinY; y < clampedMaxY; y++) {
      for (let x = clampedMinX; x < clampedMaxX; x++) {
        // Check cache first
        let tile = this.cache.get(level, x, y);
        
        if (!tile) {
          // Queue for loading
          this.queueTile(level, x, y);
          continue;
        }
        
        // Mark as visible
        tile.visible = true;
        this.cache.setVisible(level, x, y, true);
        visibleTiles.push(tile);
      }
    }
    
    // Process loading queue
    this.processQueue();
    
    return visibleTiles;
  }

  /**
   * Queue a tile for loading
   */
  private queueTile(level: number, x: number, y: number): void {
    const key = `${level}:${x}:${y}`;
    
    if (this.loadingTiles.has(key)) {
      return; // Already queued
    }
    
    this.loadingTiles.add(key);
    this.loadingQueue.push({ level, x, y });
  }

  /**
   * Process loading queue
   */
  private async processQueue(): Promise<void> {
    while (this.activeLoads < this.maxConcurrentLoads && this.loadingQueue.length > 0) {
      const item = this.loadingQueue.shift();
      if (!item) break;
      
      this.activeLoads++;
      this.loadTile(item.level, item.x, item.y)
        .finally(() => {
          this.activeLoads--;
          this.processQueue(); // Continue processing
        });
    }
  }

  /**
   * Load a single tile
   */
  private async loadTile(level: number, x: number, y: number): Promise<void> {
    const key = `${level}:${x}:${y}`;
    
    try {
      const tile = await this.source.getTile(level, x, y);
      
      if (tile) {
        this.cache.set(tile);
      }
    } catch (error) {
      console.error(`Failed to load tile ${key}:`, error);
    } finally {
      this.loadingTiles.delete(key);
    }
  }

  /**
   * Estimate zoom level from view matrix
   */
  private estimateZoom(view: ViewUniforms): number {
    // Extract scale from view matrix
    const m00 = view.viewMatrix[0] ?? 0;
    const m11 = view.viewMatrix[4] ?? 0;
    
    // Zoom is approximately the scale factor
    return Math.sqrt(m00 * m00 + m11 * m11);
  }

  /**
   * Select appropriate pyramid level based on zoom
   */
  private selectLevel(zoom: number): number {
    // Simple level selection - can be improved with screen-space error
    const baseLevel = Math.floor(Math.log2(zoom));
    return Math.max(0, Math.min(this.levelCount - 1, baseLevel));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): import('./cache.js').CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Destroy tile manager
   */
  destroy(): void {
    this.cache.clear();
    this.loadingTiles.clear();
    this.loadingQueue = [];
    this.source.destroy?.();
  }
}
