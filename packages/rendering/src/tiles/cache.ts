/**
 * Tile cache implementation with LRU eviction
 */

import type { Tile } from '../backend/types.js';

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of tiles in cache */
  tileCount: number;
  /** Total CPU memory used (bytes) */
  cpuBytes: number;
  /** Total GPU memory used (bytes) */
  gpuBytes: number;
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Maximum CPU memory in bytes (default: 512MB) */
  maxCPUBytes?: number;
  /** Maximum GPU memory in bytes (default: 1GB) */
  maxGPUBytes?: number;
  /** Maximum number of tiles (default: unlimited) */
  maxTiles?: number;
}

/**
 * Tile cache with LRU eviction
 */
export class TileCache {
  private tiles = new Map<string, Tile>();
  private cpuBytes = 0;
  private gpuBytes = 0;
  private hits = 0;
  private misses = 0;
  
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxCPUBytes: options.maxCPUBytes ?? 512 * 1024 * 1024, // 512 MB
      maxGPUBytes: options.maxGPUBytes ?? 1024 * 1024 * 1024, // 1 GB
      maxTiles: options.maxTiles ?? Infinity,
    };
  }

  /**
   * Generate cache key from tile coordinates
   */
  private getKey(level: number, x: number, y: number): string {
    return `${level}:${x}:${y}`;
  }

  /**
   * Get a tile from cache
   */
  get(level: number, x: number, y: number): Tile | null {
    const key = this.getKey(level, x, y);
    const tile = this.tiles.get(key);
    
    if (tile) {
      tile.lastAccess = Date.now();
      this.hits++;
      return tile;
    }
    
    this.misses++;
    return null;
  }

  /**
   * Add a tile to cache
   */
  set(tile: Tile): void {
    const key = this.getKey(tile.level, tile.x, tile.y);
    
    // Remove existing tile if present
    const existing = this.tiles.get(key);
    if (existing) {
      this.remove(existing);
    }
    
    // Check if we need to evict
    this.evictIfNeeded();
    
    // Add tile
    tile.lastAccess = Date.now();
    this.tiles.set(key, tile);
    
    // Track memory (estimate)
    if (tile.imageBitmap) {
      const bytes = tile.width * tile.height * 4; // RGBA
      this.cpuBytes += bytes;
    }
    
    if (tile.texture) {
      // GPU memory is tracked by backend
      // This is just a placeholder
    }
  }

  /**
   * Remove a tile from cache
   */
  remove(tile: Tile): void {
    const key = this.getKey(tile.level, tile.x, tile.y);
    const existing = this.tiles.get(key);
    
    if (existing) {
      this.tiles.delete(key);
      
      // Free memory
      if (existing.imageBitmap) {
        const bytes = existing.width * existing.height * 4;
        this.cpuBytes -= bytes;
        existing.imageBitmap.close();
      }
    }
  }

  /**
   * Evict tiles if cache limits are exceeded
   */
  private evictIfNeeded(): void {
    // Check tile count limit
    if (this.tiles.size >= this.options.maxTiles) {
      this.evictLRU(1);
    }
    
    // Check CPU memory limit
    while (this.cpuBytes > this.options.maxCPUBytes && this.tiles.size > 0) {
      this.evictLRU(1);
    }
    
    // GPU memory is managed by backend, but we track it here
    // Backend should call evictGPU() when needed
  }

  /**
   * Evict least recently used tiles
   */
  evictLRU(count: number): void {
    const tiles = Array.from(this.tiles.values());
    
    // Sort by last access time (oldest first)
    tiles.sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Evict oldest tiles
    for (let i = 0; i < Math.min(count, tiles.length); i++) {
      this.remove(tiles[i]!);
    }
  }

  /**
   * Evict tiles that are not visible
   */
  evictInvisible(): void {
    const tiles = Array.from(this.tiles.values());
    
    for (const tile of tiles) {
      if (!tile.visible) {
        this.remove(tile);
      }
    }
  }

  /**
   * Mark tiles as visible/invisible
   */
  setVisible(level: number, x: number, y: number, visible: boolean): void {
    const tile = this.get(level, x, y);
    if (tile) {
      tile.visible = visible;
      tile.lastAccess = Date.now();
    }
  }

  /**
   * Clear all tiles from cache
   */
  clear(): void {
    const tiles = Array.from(this.tiles.values());
    for (const tile of tiles) {
      this.remove(tile);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    return {
      tileCount: this.tiles.size,
      cpuBytes: this.cpuBytes,
      gpuBytes: this.gpuBytes,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Get all tiles in cache
   */
  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }

  /**
   * Get visible tiles
   */
  getVisibleTiles(): Tile[] {
    return Array.from(this.tiles.values()).filter(tile => tile.visible);
  }
}
