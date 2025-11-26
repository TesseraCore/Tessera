/**
 * Tile manager for loading and caching tiles
 * 
 * Features:
 * - Multi-level pyramid support
 * - Progressive loading (show lower-res while high-res loads)
 * - Tile prefetching (load tiles before they're visible)
 * - Priority-based loading (center tiles first)
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
  /** Enable progressive loading (show lower-res while loading) */
  progressiveLoading?: boolean;
  /** Number of tiles to prefetch beyond viewport (default: 1) */
  prefetchMargin?: number;
  /** Enable tile prefetching */
  enablePrefetch?: boolean;
  /** Enable prefetching of adjacent zoom levels (default: true) */
  enableLevelPrefetch?: boolean;
  /** Number of adjacent levels to prefetch (default: 1) */
  levelPrefetchRange?: number;
}

/**
 * Tile load request with priority
 */
interface TileRequest {
  level: number;
  x: number;
  y: number;
  priority: number; // Lower = higher priority
  isPrefetch: boolean;
}

/**
 * Tile manager for loading and managing tiles
 */
export class TileManager {
  private source: TileSource;
  private cache: TileCache;
  private loadingTiles = new Map<string, Promise<Tile | null>>();
  private loadingQueue: TileRequest[] = [];
  private activeLoads = 0;
  private maxConcurrentLoads: number;
  private imageSize: [number, number] | null = null;
  private levelCount = 0;
  
  // Feature flags
  private progressiveLoading: boolean;
  private enablePrefetch: boolean;
  private prefetchMargin: number;
  private enableLevelPrefetch: boolean;
  private levelPrefetchRange: number;
  
  // Track last viewport for prefetching
  private lastViewportCenter: [number, number] = [0, 0];
  
  // Track last logged state to avoid repetitive logging
  private lastLoggedLevel: number = -1;
  private lastLoggedTileCount: number = -1;
  
  // Track zoom direction for predictive prefetching
  private lastZoom = 1.0;
  private zoomDirection: 'in' | 'out' | 'stable' = 'stable';
  
  // Track current level for cache optimization
  private currentLevel = 0;
  
  // Initial load optimization
  private isInitialLoad = true;
  private initialLoadStartTime = 0;
  private hasDisplayedFirstTile = false;
  
  // Cache tile sizes to avoid async calls in render loop
  private cachedTileSizes = new Map<number, [number, number]>();
  
  // Deferred queue processing to avoid blocking render frames
  private queueProcessingScheduled = false;

  constructor(options: TileManagerOptions) {
    this.source = options.source;
    this.cache = new TileCache(options.cache);
    this.maxConcurrentLoads = options.maxConcurrentLoads ?? 6;
    this.progressiveLoading = options.progressiveLoading ?? true;
    this.enablePrefetch = options.enablePrefetch ?? true;
    this.prefetchMargin = options.prefetchMargin ?? 1;
    this.enableLevelPrefetch = options.enableLevelPrefetch ?? true;
    this.levelPrefetchRange = options.levelPrefetchRange ?? 1;
    
    this.init();
  }

  /**
   * Initialize tile manager
   */
  private async init(): Promise<void> {
    try {
      this.initialLoadStartTime = Date.now();
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
   * Get number of pyramid levels
   */
  getLevelCount(): number {
    return this.levelCount;
  }

  /**
   * Get visible tiles for current viewport
   * 
   * Returns tiles that should be rendered, using progressive loading
   * to show lower-res tiles while higher-res loads.
   * 
   * IMPORTANT: This method returns immediately with cached tiles only.
   * Missing tiles are queued for async loading and will appear in subsequent calls.
   */
  async getVisibleTiles(view: ViewUniforms): Promise<Tile[]> {
    // Ensure init has completed - but don't block if not ready
    if (!this.imageSize) {
      // Return empty if not initialized yet
      // Init happens asynchronously
      return [];
    }

    const [imageWidth, imageHeight] = this.imageSize;
    const [viewportWidth, viewportHeight] = view.viewportSize;
    
    // Calculate zoom and select appropriate level
    const zoom = this.estimateZoom(view);
    const targetLevel = this.selectLevel(zoom);
    
    // Track zoom direction for predictive prefetching
    this.updateZoomTracking(zoom, targetLevel);
    
    // Get tile size - use cached value if available to avoid async
    const defaultTileSize = 256;
    const tileSize = this.cachedTileSizes.get(targetLevel) ?? [defaultTileSize, defaultTileSize];
    const [tileWidth, tileHeight] = tileSize;
    
    // Async fetch tile size for next frame (don't block current frame)
    if (!this.cachedTileSizes.has(targetLevel)) {
      this.source.getTileSize(targetLevel).then(size => {
        this.cachedTileSizes.set(targetLevel, size);
      });
    }
    
    // Calculate scale factor for this level
    const levelScale = Math.pow(2, targetLevel);
    const levelImageWidth = Math.ceil(imageWidth / levelScale);
    const levelImageHeight = Math.ceil(imageHeight / levelScale);
    
    // Convert viewport to image coordinates
    const viewportBounds = this.getViewportBoundsInImageSpace(view, viewportWidth, viewportHeight);
    
    // Scale bounds to level coordinates
    const levelBounds = {
      minX: viewportBounds.minX / levelScale,
      maxX: viewportBounds.maxX / levelScale,
      minY: viewportBounds.minY / levelScale,
      maxY: viewportBounds.maxY / levelScale,
    };
    
    // Calculate tile grid bounds at target level
    const tileMinX = Math.max(0, Math.floor(levelBounds.minX / tileWidth));
    const tileMaxX = Math.min(Math.ceil(levelImageWidth / tileWidth), Math.ceil(levelBounds.maxX / tileWidth));
    const tileMinY = Math.max(0, Math.floor(levelBounds.minY / tileHeight));
    const tileMaxY = Math.min(Math.ceil(levelImageHeight / tileHeight), Math.ceil(levelBounds.maxY / tileHeight));
    
    // Only log when level or tile count changes significantly
    const tileCount = (tileMaxX - tileMinX) * (tileMaxY - tileMinY);
    if (targetLevel !== this.lastLoggedLevel || Math.abs(tileCount - this.lastLoggedTileCount) > 5) {
      console.debug(`[TileManager] Level ${targetLevel} (zoom: ${zoom.toFixed(2)}), ${tileCount} tiles needed`);
      this.lastLoggedLevel = targetLevel;
      this.lastLoggedTileCount = tileCount;
    }
    
    // Update viewport center for priority calculation
    this.lastViewportCenter = [
      (levelBounds.minX + levelBounds.maxX) / 2 / tileWidth,
      (levelBounds.minY + levelBounds.maxY) / 2 / tileHeight,
    ];
    
    // Collect visible tiles
    const visibleTiles: Tile[] = [];
    const tilesToLoad: TileRequest[] = [];
    
    for (let y = tileMinY; y < tileMaxY; y++) {
      for (let x = tileMinX; x < tileMaxX; x++) {
        const tileKey = `${targetLevel}:${x}:${y}`;
        
        // Check if tile is currently loading (don't count as cache miss)
        const isLoading = this.loadingTiles.has(tileKey);
        
        // Check cache - use has() first to avoid counting loading tiles as misses
        let tile: Tile | null = null;
        if (!isLoading) {
          tile = this.cache.get(targetLevel, x, y);
        } else {
          // For loading tiles, peek at cache without affecting hit/miss stats
          tile = this.cache.peek(targetLevel, x, y);
        }
        
        if (tile && tile.imageBitmap) {
          // Have the tile at target level
          tile.visible = true;
          this.cache.setVisible(targetLevel, x, y, true);
          visibleTiles.push(tile);
        } else if (!isLoading) {
          // Need to load this tile (only if not already loading)
          const priority = this.calculatePriority(x, y, false, targetLevel);
          tilesToLoad.push({ level: targetLevel, x, y, priority, isPrefetch: false });
          
          // Progressive loading: try to find a fallback tile from a lower-res level
          if (this.progressiveLoading) {
            const fallbackTile = this.findFallbackTile(targetLevel, x, y, levelScale);
            if (fallbackTile) {
              visibleTiles.push(fallbackTile);
            }
          }
        } else {
          // Tile is loading - try fallback in the meantime
          if (this.progressiveLoading) {
            const fallbackTile = this.findFallbackTile(targetLevel, x, y, levelScale);
            if (fallbackTile) {
              visibleTiles.push(fallbackTile);
            }
          }
        }
      }
    }
    
    // During initial load, skip prefetching to prioritize visible tiles
    const shouldPrefetch = !this.isInitialLoad || this.hasDisplayedFirstTile;
    
    // Add prefetch tiles (tiles just outside viewport)
    if (this.enablePrefetch && shouldPrefetch) {
      const prefetchTiles = this.getPrefetchTiles(
        targetLevel, tileMinX, tileMaxX, tileMinY, tileMaxY,
        Math.ceil(levelImageWidth / tileWidth),
        Math.ceil(levelImageHeight / tileHeight)
      );
      tilesToLoad.push(...prefetchTiles);
    }
    
    // Add adjacent level prefetch for smooth zoom transitions
    // Skip during initial load to get first frame displayed faster
    if (this.enableLevelPrefetch && shouldPrefetch) {
      const levelPrefetchTiles = this.getAdjacentLevelPrefetchTiles(
        targetLevel, 
        levelBounds,
        levelScale
      );
      tilesToLoad.push(...levelPrefetchTiles);
    }
    
    // Queue tiles for loading with priority
    for (const request of tilesToLoad) {
      this.queueTile(request);
    }
    
    // Process loading queue OUTSIDE the render frame
    // This prevents tile decoding from blocking the frame
    this.scheduleQueueProcessing();
    
    return visibleTiles;
  }

  /**
   * Get viewport bounds in image space
   */
  private getViewportBoundsInImageSpace(
    view: ViewUniforms,
    viewportWidth: number,
    viewportHeight: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const invMatrix = view.invViewMatrix;
    const m00 = invMatrix[0] ?? 0;
    const m01 = invMatrix[1] ?? 0;
    const m02 = invMatrix[2] ?? 0;
    const m10 = invMatrix[3] ?? 0;
    const m11 = invMatrix[4] ?? 0;
    const m12 = invMatrix[5] ?? 0;
    
    // Get viewport corners in image space
    const corners = [
      [m00 * 0 + m01 * 0 + m02, m10 * 0 + m11 * 0 + m12],
      [m00 * viewportWidth + m01 * 0 + m02, m10 * viewportWidth + m11 * 0 + m12],
      [m00 * 0 + m01 * viewportHeight + m02, m10 * 0 + m11 * viewportHeight + m12],
      [m00 * viewportWidth + m01 * viewportHeight + m02, m10 * viewportWidth + m11 * viewportHeight + m12],
    ];
    
    return {
      minX: Math.min(corners[0]![0]!, corners[1]![0]!, corners[2]![0]!, corners[3]![0]!),
      maxX: Math.max(corners[0]![0]!, corners[1]![0]!, corners[2]![0]!, corners[3]![0]!),
      minY: Math.min(corners[0]![1]!, corners[1]![1]!, corners[2]![1]!, corners[3]![1]!),
      maxY: Math.max(corners[0]![1]!, corners[1]![1]!, corners[2]![1]!, corners[3]![1]!),
    };
  }

  /**
   * Find a fallback tile from a lower resolution level
   * 
   * When a high-res tile isn't loaded yet, we can show a portion
   * of a lower-res tile as a placeholder.
   */
  private findFallbackTile(
    targetLevel: number,
    targetX: number,
    targetY: number,
    _targetScale: number
  ): Tile | null {
    // Try progressively lower resolution levels
    for (let fallbackLevel = targetLevel + 1; fallbackLevel < this.levelCount; fallbackLevel++) {
      // Calculate which tile at the fallback level covers this area
      const levelDiff = fallbackLevel - targetLevel;
      const scaleFactor = Math.pow(2, levelDiff);
      
      const fallbackX = Math.floor(targetX / scaleFactor);
      const fallbackY = Math.floor(targetY / scaleFactor);
      
      const fallbackTile = this.cache.get(fallbackLevel, fallbackX, fallbackY);
      
      if (fallbackTile && fallbackTile.imageBitmap) {
        // Return the fallback tile - it will be drawn covering a larger area
        // The renderer should handle the scaling appropriately
        return fallbackTile;
      }
    }
    
    return null;
  }

  /**
   * Get tiles to prefetch (just outside the visible viewport)
   */
  private getPrefetchTiles(
    level: number,
    visibleMinX: number,
    visibleMaxX: number,
    visibleMinY: number,
    visibleMaxY: number,
    maxTilesX: number,
    maxTilesY: number
  ): TileRequest[] {
    const prefetchTiles: TileRequest[] = [];
    const margin = this.prefetchMargin;
    
    // Expand bounds by margin
    const prefetchMinX = Math.max(0, visibleMinX - margin);
    const prefetchMaxX = Math.min(maxTilesX, visibleMaxX + margin);
    const prefetchMinY = Math.max(0, visibleMinY - margin);
    const prefetchMaxY = Math.min(maxTilesY, visibleMaxY + margin);
    
    for (let y = prefetchMinY; y < prefetchMaxY; y++) {
      for (let x = prefetchMinX; x < prefetchMaxX; x++) {
        // Skip tiles that are in the visible area (already queued)
        if (x >= visibleMinX && x < visibleMaxX && y >= visibleMinY && y < visibleMaxY) {
          continue;
        }
        
        // Check if already cached
        if (this.cache.get(level, x, y)) {
          continue;
        }
        
        const priority = this.calculatePriority(x, y, true);
        prefetchTiles.push({ level, x, y, priority, isPrefetch: true });
      }
    }
    
    return prefetchTiles;
  }

  /**
   * Track zoom direction and update cache active level
   */
  private updateZoomTracking(zoom: number, targetLevel: number): void {
    // Detect zoom direction
    const zoomDelta = zoom - this.lastZoom;
    const zoomThreshold = 0.01; // Small threshold to filter noise
    
    if (zoomDelta > zoomThreshold) {
      this.zoomDirection = 'in';
    } else if (zoomDelta < -zoomThreshold) {
      this.zoomDirection = 'out';
    } else {
      this.zoomDirection = 'stable';
    }
    
    this.lastZoom = zoom;
    
    // Track level changes
    if (targetLevel !== this.currentLevel) {
      this.currentLevel = targetLevel;
    }
    
    // Notify cache of active level for smarter eviction
    this.cache.setActiveLevel(targetLevel);
  }

  /**
   * Get tiles from adjacent levels to prefetch for smooth zoom transitions
   * 
   * This prefetches tiles from levels N-1 and N+1 that cover the current viewport,
   * prioritizing based on zoom direction (prefetch zoom-in level when zooming in, etc.)
   */
  private getAdjacentLevelPrefetchTiles(
    currentLevel: number,
    viewportBounds: { minX: number; maxX: number; minY: number; maxY: number },
    _currentLevelScale: number
  ): TileRequest[] {
    const prefetchTiles: TileRequest[] = [];
    
    // Determine which adjacent levels to prefetch based on zoom direction
    const levelsToFetch: number[] = [];
    
    if (this.zoomDirection === 'in' && currentLevel > 0) {
      // Zooming in: prioritize higher resolution (lower level number)
      levelsToFetch.push(currentLevel - 1);
      if (this.levelPrefetchRange > 1 && currentLevel < this.levelCount - 1) {
        levelsToFetch.push(currentLevel + 1);
      }
    } else if (this.zoomDirection === 'out' && currentLevel < this.levelCount - 1) {
      // Zooming out: prioritize lower resolution (higher level number)
      levelsToFetch.push(currentLevel + 1);
      if (this.levelPrefetchRange > 1 && currentLevel > 0) {
        levelsToFetch.push(currentLevel - 1);
      }
    } else {
      // Stable: prefetch both adjacent levels with equal priority
      for (let offset = 1; offset <= this.levelPrefetchRange; offset++) {
        if (currentLevel - offset >= 0) {
          levelsToFetch.push(currentLevel - offset);
        }
        if (currentLevel + offset < this.levelCount) {
          levelsToFetch.push(currentLevel + offset);
        }
      }
    }
    
    // Get tiles for each adjacent level
    for (const level of levelsToFetch) {
      const levelDiff = level - currentLevel;
      const relativeScale = Math.pow(2, levelDiff);
      
      // Convert viewport bounds to this level's coordinate space
      const levelBounds = {
        minX: viewportBounds.minX * relativeScale,
        maxX: viewportBounds.maxX * relativeScale,
        minY: viewportBounds.minY * relativeScale,
        maxY: viewportBounds.maxY * relativeScale,
      };
      
      // Get tile size for this level
      // Note: We use the current level's tile size as an approximation
      // since getTileSize is async and we want to keep this synchronous
      const tileSize = 256; // Default tile size
      
      const tileMinX = Math.max(0, Math.floor(levelBounds.minX / tileSize));
      const tileMaxX = Math.ceil(levelBounds.maxX / tileSize);
      const tileMinY = Math.max(0, Math.floor(levelBounds.minY / tileSize));
      const tileMaxY = Math.ceil(levelBounds.maxY / tileSize);
      
      // Limit the number of tiles to prefetch per level to avoid overloading
      const maxTilesPerLevel = 4;
      let tilesAdded = 0;
      
      for (let y = tileMinY; y < tileMaxY && tilesAdded < maxTilesPerLevel; y++) {
        for (let x = tileMinX; x < tileMaxX && tilesAdded < maxTilesPerLevel; x++) {
          // Check if already cached
          if (this.cache.has(level, x, y)) {
            continue;
          }
          
          // Higher priority penalty for level prefetch (lower priority than viewport prefetch)
          const basePriority = this.calculatePriority(
            x * relativeScale, 
            y * relativeScale, 
            true
          );
          const levelPenalty = 500 + Math.abs(levelDiff) * 100;
          
          prefetchTiles.push({ 
            level, 
            x, 
            y, 
            priority: basePriority + levelPenalty, 
            isPrefetch: true 
          });
          tilesAdded++;
        }
      }
    }
    
    return prefetchTiles;
  }

  /**
   * Calculate loading priority for a tile
   * Lower number = higher priority
   */
  private calculatePriority(x: number, y: number, isPrefetch: boolean, level?: number): number {
    // Distance from viewport center
    const dx = x - this.lastViewportCenter[0];
    const dy = y - this.lastViewportCenter[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Prefetch tiles have lower priority (higher number)
    const prefetchPenalty = isPrefetch ? 1000 : 0;
    
    // During initial load, strongly prioritize lower resolution levels
    // This gets SOMETHING on screen fast
    let levelBonus = 0;
    if (this.isInitialLoad && level !== undefined) {
      // Higher levels (lower res) get priority boost during initial load
      // Level 0 = no bonus, highest level = -500 (higher priority)
      const maxLevel = this.levelCount - 1;
      if (maxLevel > 0) {
        levelBonus = -((level / maxLevel) * 500);
      }
    }
    
    return distance + prefetchPenalty + levelBonus;
  }

  /**
   * Queue a tile for loading with priority
   */
  private queueTile(request: TileRequest): void {
    const key = `${request.level}:${request.x}:${request.y}`;
    
    if (this.loadingTiles.has(key)) {
      return; // Already loading
    }
    
    if (this.cache.get(request.level, request.x, request.y)) {
      return; // Already cached
    }
    
    // Insert into queue maintaining priority order
    const insertIndex = this.loadingQueue.findIndex(r => r.priority > request.priority);
    if (insertIndex === -1) {
      this.loadingQueue.push(request);
    } else {
      this.loadingQueue.splice(insertIndex, 0, request);
    }
  }

  /**
   * Schedule queue processing outside the current frame
   * Uses requestIdleCallback when available, falls back to setTimeout
   */
  private scheduleQueueProcessing(): void {
    if (this.queueProcessingScheduled || this.loadingQueue.length === 0) {
      return;
    }
    
    this.queueProcessingScheduled = true;
    
    // Use requestIdleCallback to process tiles when browser is idle
    // This prevents tile decoding from blocking render frames
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        this.queueProcessingScheduled = false;
        this.processQueue();
      }, { timeout: 100 }); // Max delay 100ms
    } else {
      // Fallback: use setTimeout to defer to next event loop tick
      setTimeout(() => {
        this.queueProcessingScheduled = false;
        this.processQueue();
      }, 0);
    }
  }

  /**
   * Process loading queue
   * Only processes a limited number of tiles per call to avoid blocking
   */
  private async processQueue(): Promise<void> {
    // Limit concurrent loads more aggressively during initial load
    // to prevent CPU overload during first display
    const effectiveMaxLoads = this.isInitialLoad ? 
      Math.min(2, this.maxConcurrentLoads) : 
      this.maxConcurrentLoads;
    
    // Limit tiles started per processing cycle to avoid CPU spikes
    const maxStartsPerCycle = this.isInitialLoad ? 1 : 2;
    let startsThisCycle = 0;
    
    while (
      this.activeLoads < effectiveMaxLoads && 
      this.loadingQueue.length > 0 &&
      startsThisCycle < maxStartsPerCycle
    ) {
      const request = this.loadingQueue.shift();
      if (!request) break;
      
      const key = `${request.level}:${request.x}:${request.y}`;
      
      // Skip if already loading or cached
      if (this.loadingTiles.has(key) || this.cache.get(request.level, request.x, request.y)) {
        continue;
      }
      
      this.activeLoads++;
      startsThisCycle++;
      
      const loadPromise = this.loadTile(request.level, request.x, request.y);
      this.loadingTiles.set(key, loadPromise);
      
      loadPromise
        .finally(() => {
          this.activeLoads--;
          this.loadingTiles.delete(key);
          // Schedule more processing (deferred)
          this.scheduleQueueProcessing();
        });
    }
    
    // If there are more tiles to load, schedule another processing cycle
    if (this.loadingQueue.length > 0 && this.activeLoads < this.maxConcurrentLoads) {
      this.scheduleQueueProcessing();
    }
  }

  /**
   * Load a single tile
   */
  private async loadTile(level: number, x: number, y: number): Promise<Tile | null> {
    try {
      const tile = await this.source.getTile(level, x, y);
      
      if (tile) {
        this.cache.set(tile);
        
        // Track initial load completion
        if (this.isInitialLoad && !this.hasDisplayedFirstTile) {
          this.hasDisplayedFirstTile = true;
          const loadTime = Date.now() - this.initialLoadStartTime;
          console.debug(`[TileManager] First tile displayed in ${loadTime}ms`);
        }
        
        return tile;
      }
    } catch (error) {
      console.error(`Failed to load tile ${level}/${x}/${y}:`, error);
    }
    
    return null;
  }
  
  /**
   * Mark initial load as complete (call after first successful render)
   */
  markInitialLoadComplete(): void {
    if (this.isInitialLoad) {
      this.isInitialLoad = false;
      const loadTime = Date.now() - this.initialLoadStartTime;
      console.debug(`[TileManager] Initial load complete in ${loadTime}ms`);
    }
  }

  /**
   * Estimate zoom level from view matrix
   */
  private estimateZoom(view: ViewUniforms): number {
    const m00 = view.viewMatrix[0] ?? 0;
    const m10 = view.viewMatrix[3] ?? 0;
    return Math.sqrt(m00 * m00 + m10 * m10);
  }

  /**
   * Select appropriate pyramid level based on zoom
   */
  private selectLevel(zoom: number): number {
    // For single-level sources (like non-pyramidal TIFFs), always use level 0
    if (this.levelCount <= 1) {
      return 0;
    }
    
    if (zoom >= 1.0) {
      return 0;
    }
    
    const level = Math.floor(-Math.log2(zoom));
    return Math.max(0, Math.min(this.levelCount - 1, level));
  }

  /**
   * Cancel pending loads for tiles that are no longer needed
   */
  cancelStaleLoads(): void {
    // Remove prefetch tiles from queue if we have enough visible tiles loading
    const visibleLoading = this.loadingQueue.filter(r => !r.isPrefetch).length;
    if (visibleLoading > this.maxConcurrentLoads * 2) {
      this.loadingQueue = this.loadingQueue.filter(r => !r.isPrefetch);
    }
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
    this.loadingQueue = [];
  }

  /**
   * Check if a specific tile is loaded
   */
  isTileLoaded(level: number, x: number, y: number): boolean {
    return this.cache.get(level, x, y) !== null;
  }

  /**
   * Get the number of tiles currently loading
   */
  getLoadingCount(): number {
    return this.loadingTiles.size;
  }

  /**
   * Get the number of tiles in the load queue
   */
  getQueueLength(): number {
    return this.loadingQueue.length;
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


