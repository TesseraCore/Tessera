/**
 * Tile cache implementation with LRU eviction
 * 
 * Features:
 * - LRU (Least Recently Used) eviction
 * - Memory limits (CPU and GPU)
 * - Level-aware caching for pyramid support
 * - Visibility tracking
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
  /** Number of tiles per level */
  tilesPerLevel: Map<number, number>;
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
  /** Preferred levels to keep in cache (e.g., [0, 1] keeps high-res) */
  preferredLevels?: number[];
}

/**
 * Tile cache with LRU eviction and level awareness
 */
export class TileCache {
  private tiles = new Map<string, Tile>();
  private cpuBytes = 0;
  private gpuBytes = 0;
  private hits = 0;
  private misses = 0;
  
  // Index by level for faster level-based lookups
  private tilesByLevel = new Map<number, Set<string>>();
  
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxCPUBytes: options.maxCPUBytes ?? 512 * 1024 * 1024, // 512 MB
      maxGPUBytes: options.maxGPUBytes ?? 1024 * 1024 * 1024, // 1 GB
      maxTiles: options.maxTiles ?? Infinity,
      preferredLevels: options.preferredLevels ?? [],
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
   * Check if a tile exists in cache
   */
  has(level: number, x: number, y: number): boolean {
    return this.tiles.has(this.getKey(level, x, y));
  }

  /**
   * Add a tile to cache
   */
  set(tile: Tile): void {
    const key = this.getKey(tile.level, tile.x, tile.y);
    
    // Remove existing tile if present
    const existing = this.tiles.get(key);
    if (existing) {
      this.removeInternal(key, existing);
    }
    
    // Check if we need to evict
    this.evictIfNeeded();
    
    // Add tile
    tile.lastAccess = Date.now();
    this.tiles.set(key, tile);
    
    // Update level index
    if (!this.tilesByLevel.has(tile.level)) {
      this.tilesByLevel.set(tile.level, new Set());
    }
    this.tilesByLevel.get(tile.level)!.add(key);
    
    // Track memory (estimate)
    if (tile.imageBitmap) {
      const bytes = tile.width * tile.height * 4; // RGBA
      this.cpuBytes += bytes;
    }
    
    if (tile.texture) {
      // GPU memory tracking placeholder
    }
  }

  /**
   * Remove a tile from cache
   */
  remove(tile: Tile): void {
    const key = this.getKey(tile.level, tile.x, tile.y);
    this.removeByKey(key);
  }

  /**
   * Remove a tile by key
   */
  private removeByKey(key: string): void {
    const tile = this.tiles.get(key);
    if (tile) {
      this.removeInternal(key, tile);
    }
  }

  /**
   * Internal remove implementation
   */
  private removeInternal(key: string, tile: Tile): void {
    this.tiles.delete(key);
    
    // Update level index
    const levelTiles = this.tilesByLevel.get(tile.level);
    if (levelTiles) {
      levelTiles.delete(key);
      if (levelTiles.size === 0) {
        this.tilesByLevel.delete(tile.level);
      }
    }
    
    // Free memory
    if (tile.imageBitmap) {
      const bytes = tile.width * tile.height * 4;
      this.cpuBytes = Math.max(0, this.cpuBytes - bytes);
      tile.imageBitmap.close();
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
  }

  /**
   * Evict least recently used tiles
   * Respects preferred levels by evicting non-preferred first
   */
  evictLRU(count: number): void {
    const tiles = Array.from(this.tiles.entries());
    
    // Sort by priority: non-visible first, then non-preferred levels, then by access time
    tiles.sort(([_keyA, a], [_keyB, b]) => {
      // Visible tiles are kept longer
      if (a.visible !== b.visible) {
        return a.visible ? 1 : -1;
      }
      
      // Preferred levels are kept longer
      const aPreferred = this.options.preferredLevels.includes(a.level);
      const bPreferred = this.options.preferredLevels.includes(b.level);
      if (aPreferred !== bPreferred) {
        return aPreferred ? 1 : -1;
      }
      
      // Lower levels (higher res) are kept longer by default
      if (a.level !== b.level) {
        return b.level - a.level; // Evict higher level numbers first
      }
      
      // Finally, sort by last access time
      return a.lastAccess - b.lastAccess;
    });
    
    // Evict tiles
    for (let i = 0; i < Math.min(count, tiles.length); i++) {
      const [key] = tiles[i]!;
      this.removeByKey(key);
    }
  }

  /**
   * Evict tiles that are not visible
   */
  evictInvisible(): void {
    const tiles = Array.from(this.tiles.entries());
    
    for (const [key, tile] of tiles) {
      if (!tile.visible) {
        this.removeByKey(key);
      }
    }
  }

  /**
   * Evict all tiles at a specific level
   */
  evictLevel(level: number): void {
    const levelTiles = this.tilesByLevel.get(level);
    if (!levelTiles) return;
    
    for (const key of [...levelTiles]) {
      this.removeByKey(key);
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
   * Mark all tiles at a level as invisible
   */
  setLevelInvisible(level: number): void {
    const levelTiles = this.tilesByLevel.get(level);
    if (!levelTiles) return;
    
    for (const key of levelTiles) {
      const tile = this.tiles.get(key);
      if (tile) {
        tile.visible = false;
      }
    }
  }

  /**
   * Mark all tiles as invisible
   */
  markAllInvisible(): void {
    for (const tile of this.tiles.values()) {
      tile.visible = false;
    }
  }

  /**
   * Get all tiles at a specific level
   */
  getTilesAtLevel(level: number): Tile[] {
    const levelTiles = this.tilesByLevel.get(level);
    if (!levelTiles) return [];
    
    const tiles: Tile[] = [];
    for (const key of levelTiles) {
      const tile = this.tiles.get(key);
      if (tile) {
        tiles.push(tile);
      }
    }
    return tiles;
  }

  /**
   * Find tiles at a level that cover a given area in image space
   */
  findCoveringTiles(
    level: number,
    imageX: number,
    imageY: number,
    imageWidth: number,
    imageHeight: number
  ): Tile[] {
    const levelTiles = this.getTilesAtLevel(level);
    
    return levelTiles.filter(tile => {
      // Check if tile overlaps with the given area
      const tileRight = tile.imageX + tile.width;
      const tileBottom = tile.imageY + tile.height;
      const areaRight = imageX + imageWidth;
      const areaBottom = imageY + imageHeight;
      
      return !(tile.imageX >= areaRight || tileRight <= imageX ||
               tile.imageY >= areaBottom || tileBottom <= imageY);
    });
  }

  /**
   * Clear all tiles from cache
   */
  clear(): void {
    const keys = [...this.tiles.keys()];
    for (const key of keys) {
      this.removeByKey(key);
    }
    this.tilesByLevel.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    // Count tiles per level
    const tilesPerLevel = new Map<number, number>();
    for (const [level, keys] of this.tilesByLevel) {
      tilesPerLevel.set(level, keys.size);
    }
    
    return {
      tileCount: this.tiles.size,
      cpuBytes: this.cpuBytes,
      gpuBytes: this.gpuBytes,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      tilesPerLevel,
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

  /**
   * Get levels that have tiles in cache
   */
  getCachedLevels(): number[] {
    return Array.from(this.tilesByLevel.keys()).sort((a, b) => a - b);
  }
}
