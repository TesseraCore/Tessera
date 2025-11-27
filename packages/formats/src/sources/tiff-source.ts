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
 * Pyramid level info for virtual pyramid generation
 */
interface PyramidLevel {
  /** Level index (0 = full resolution) */
  level: number;
  /** Width at this level */
  width: number;
  /** Height at this level */
  height: number;
  /** Scale factor (1.0 for level 0, 0.5 for level 1, etc.) */
  scale: number;
  /** Number of tiles horizontally */
  tilesAcross: number;
  /** Number of tiles vertically */
  tilesDown: number;
}

/**
 * Threshold level above which we use overview instead of recursive generation
 * Level 2+ will use overview (level 0 and 1 will still composite from native tiles)
 */
// Level at which we switch from recursive generation to overview-based generation
// Level 3 = 8x8 = 64 level 0 tiles max per tile, which is manageable
const OVERVIEW_THRESHOLD_LEVEL = 3;

// Maximum number of tiles to load for overview generation
const MAX_OVERVIEW_TILES = 36;

/**
 * TIFF tile source for tiled TIFF images
 * 
 * Supports virtual pyramid generation for smooth zooming:
 * - Level 0: Native TIFF tiles at full resolution
 * - Level 1+: Dynamically generated lower-resolution tiles
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
  
  // Internal cache for level 0 tiles (needed to generate virtual pyramid tiles)
  // Size must be at least MAX_OVERVIEW_TILES to prevent eviction during overview generation
  private tileCache = new Map<string, ImageBitmap>();
  private maxCachedTiles = 48; // Must be >= MAX_OVERVIEW_TILES (36) + buffer for concurrent loads
  private tileAccessOrder: string[] = []; // LRU tracking
  
  // Compression and color settings
  private compression: number;
  private photometric: number;
  private samplesPerPixel: number;
  private bitsPerSample: number | number[];
  private predictor: number;
  
  // Virtual pyramid for smooth zooming
  private levels: PyramidLevel[] = [];
  
  // Overview bitmap for fast high-level tile generation
  // Generated once from a small set of level 0 tiles, then reused
  private overviewBitmap: ImageBitmap | null = null;
  private overviewGenerating = false;
  private overviewPromise: Promise<ImageBitmap | null> | null = null;

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
    
    // Initialize virtual pyramid levels
    this.initializePyramid();
    
    // Log tile source summary
    const compressionInfo = this.compression !== TIFFCompression.None 
      ? `, ${getCompressionName(this.compression)}${!isCompressionSupported(this.compression) ? ' ⚠️' : ''}`
      : '';
    console.info(`[TIFF] 🖼️ ${this.width}×${this.height} | ${this.tilesAcross}×${this.tilesDown} tiles (${this.tileWidth}×${this.tileHeight} each)${compressionInfo} | ${this.levels.length} pyramid levels`);
  }
  
  /**
   * Initialize virtual pyramid level structure
   * Creates enough levels so the smallest fits in roughly one tile
   * Limited to prevent excessive tile loading for very zoomed out views
   */
  private initializePyramid(): void {
    const minDimension = Math.min(this.width, this.height);
    const maxTileDim = Math.max(this.tileWidth, this.tileHeight);
    
    // Calculate how many levels we need (enough so smallest fits in ~1-2 tiles)
    // But limit to avoid exponential tile loading for high levels
    const maxLevels = 5; // Levels 0-4 (level 4 = 16x downscale, needs up to 256 tiles)
    const levelCount = Math.min(maxLevels, Math.max(1, Math.ceil(Math.log2(minDimension / maxTileDim)) + 1));
    
    this.levels = [];
    for (let i = 0; i < levelCount; i++) {
      const scale = 1 / Math.pow(2, i);
      const levelWidth = Math.max(1, Math.ceil(this.width * scale));
      const levelHeight = Math.max(1, Math.ceil(this.height * scale));
      
      this.levels.push({
        level: i,
        width: levelWidth,
        height: levelHeight,
        scale,
        tilesAcross: Math.ceil(levelWidth / this.tileWidth),
        tilesDown: Math.ceil(levelHeight / this.tileHeight),
      });
    }
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    const startTime = performance.now();
    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }
    
    // Validate tile coordinates for this level
    if (x < 0 || x >= levelInfo.tilesAcross || y < 0 || y >= levelInfo.tilesDown) {
      return null;
    }
    
    let result: Tile | null;
    
    // For level 0, load from native TIFF tiles (with internal caching)
    if (level === 0) {
      result = await this.loadNativeTile(x, y);
    } else if (level >= OVERVIEW_THRESHOLD_LEVEL) {
      // For high levels (zoomed out), use cached overview for FAST generation
      // This avoids the exponential recursive tile loading
      result = await this.generateTileFromOverview(level, x, y);
    } else {
      // For level 1, generate from native tiles (limited recursion depth)
      result = await this.generateVirtualTile(level, x, y);
    }
    
    const elapsed = performance.now() - startTime;
    if (elapsed > 500) {
      console.warn(`[TIFF] Slow tile ${level}/${x}/${y}: ${elapsed.toFixed(0)}ms`);
    }
    
    return result;
  }
  
  /**
   * Add a tile to internal cache with LRU eviction
   * Only used for level 0 tiles which are needed to generate virtual tiles
   */
  private addToInternalCache(key: string, bitmap: ImageBitmap): void {
    // Remove from access order if already exists
    const existingIndex = this.tileAccessOrder.indexOf(key);
    if (existingIndex !== -1) {
      this.tileAccessOrder.splice(existingIndex, 1);
    }
    
    // Evict oldest tiles if at capacity
    while (this.tileCache.size >= this.maxCachedTiles && this.tileAccessOrder.length > 0) {
      const oldestKey = this.tileAccessOrder.shift();
      if (oldestKey) {
        const oldBitmap = this.tileCache.get(oldestKey);
        if (oldBitmap) {
          oldBitmap.close();
        }
        this.tileCache.delete(oldestKey);
      }
    }
    
    // Add new tile
    this.tileCache.set(key, bitmap);
    this.tileAccessOrder.push(key);
  }
  
  /**
   * Get a tile from internal cache, updating LRU order
   */
  private getFromInternalCache(key: string): ImageBitmap | undefined {
    const bitmap = this.tileCache.get(key);
    if (bitmap) {
      // Update LRU order
      const index = this.tileAccessOrder.indexOf(key);
      if (index !== -1) {
        this.tileAccessOrder.splice(index, 1);
        this.tileAccessOrder.push(key);
      }
    }
    return bitmap;
  }
  
  /**
   * Load a native TIFF tile (level 0)
   */
  private async loadNativeTile(x: number, y: number): Promise<Tile | null> {
    // Validate tile coordinates for level 0
    if (x < 0 || x >= this.tilesAcross || y < 0 || y >= this.tilesDown) {
      return null;
    }

    // Calculate tile index
    const tileIndex = y * this.tilesAcross + x;
    if (tileIndex >= this.tileOffsets.length) {
      return null;
    }

    // Check internal cache (level 0 tiles are cached for pyramid generation)
    const cacheKey = `0:${x}:${y}`;
    let imageBitmap = this.getFromInternalCache(cacheKey);

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

        // Cache the level 0 tile (needed for virtual pyramid generation)
        this.addToInternalCache(cacheKey, imageBitmap);
      } catch (error) {
        console.error(`[TIFFTileSource] Error decoding tile ${x},${y}:`, error);
        return null;
      }
    }

    // Calculate tile position in image space (level 0 = full resolution)
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
  
  /**
   * Generate a virtual tile for levels > 0 by downscaling from the previous level
   * For level 1, generates from level 0 (native tiles)
   * For level 2+, generates from level-1 (recursive, but each level is cached by TileManager)
   */
  private async generateVirtualTile(level: number, x: number, y: number): Promise<Tile | null> {
    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }
    
    // Calculate this tile's bounds in level coordinates
    // Use native tile dimensions for consistency
    const levelTileX = x * this.tileWidth;
    const levelTileY = y * this.tileHeight;
    const tileWidth = Math.min(this.tileWidth, levelInfo.width - levelTileX);
    const tileHeight = Math.min(this.tileHeight, levelInfo.height - levelTileY);
    
    if (tileWidth <= 0 || tileHeight <= 0) {
      return null;
    }
    
    // For level 1, we generate directly from level 0 (native) tiles
    // For level 2+, we could use recursive generation from level-1,
    // but that leads to the TIFFTileSource bypassing the TileManager cache
    // So we always generate from level 0 tiles, but limit the tile count
    
    // Calculate which level 0 tiles we need
    const scaleFactor = Math.pow(2, level);
    
    // Bounds in level 0 pixel space
    const level0MinX = levelTileX * scaleFactor;
    const level0MinY = levelTileY * scaleFactor;
    const level0MaxX = Math.min((levelTileX + tileWidth) * scaleFactor, this.width);
    const level0MaxY = Math.min((levelTileY + tileHeight) * scaleFactor, this.height);
    
    // Calculate which level 0 tiles cover this area
    const tile0MinX = Math.floor(level0MinX / this.tileWidth);
    const tile0MaxX = Math.ceil(level0MaxX / this.tileWidth);
    const tile0MinY = Math.floor(level0MinY / this.tileHeight);
    const tile0MaxY = Math.ceil(level0MaxY / this.tileHeight);
    
    // Count how many tiles we'd need to load
    const tilesNeeded = (tile0MaxX - tile0MinX) * (tile0MaxY - tile0MinY);
    
    // Limit tile loading to prevent slow generation
    // For level 1: typically 4 tiles (2x2)
    // For level 2: typically 16 tiles (4x4)
    // Beyond that, fall back to overview for faster (if lower quality) results
    const maxTilesPerVirtual = 16;
    if (tilesNeeded > maxTilesPerVirtual) {
      // Too many tiles - fall back to overview
      return this.generateTileFromOverview(level, x, y);
    }
    
    // Create a canvas to composite the downscaled image
    const canvas = new OffscreenCanvas(tileWidth, tileHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    
    // Enable high-quality scaling (use 'medium' for faster initial load)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    
    // Build list of tiles to load
    const tileCoords: Array<{ tx: number; ty: number }> = [];
    for (let ty = tile0MinY; ty < tile0MaxY; ty++) {
      for (let tx = tile0MinX; tx < tile0MaxX; tx++) {
        tileCoords.push({ tx, ty });
      }
    }
    
    // Load tiles in parallel (limited concurrency)
    const concurrency = Math.min(4, tileCoords.length);
    const loadedTiles: Array<{ tile: Tile | null; tx: number; ty: number }> = [];
    
    for (let i = 0; i < tileCoords.length; i += concurrency) {
      const batch = tileCoords.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async ({ tx, ty }) => ({
          tile: await this.loadNativeTile(tx, ty),
          tx,
          ty,
        }))
      );
      loadedTiles.push(...results);
    }
    
    // Draw all loaded tiles
    let hasAnyTile = false;
    for (const { tile: sourceTile, tx, ty } of loadedTiles) {
      if (!sourceTile || !sourceTile.imageBitmap) {
        continue;
      }
      
      hasAnyTile = true;
      
      // Calculate where this tile's pixels fall in our output
      // Source tile position in level 0 pixels
      const srcTileX = tx * this.tileWidth;
      const srcTileY = ty * this.tileHeight;
      
      // What portion of the source tile do we need?
      const srcStartX = Math.max(0, level0MinX - srcTileX);
      const srcStartY = Math.max(0, level0MinY - srcTileY);
      const srcEndX = Math.min(sourceTile.imageBitmap.width, level0MaxX - srcTileX);
      const srcEndY = Math.min(sourceTile.imageBitmap.height, level0MaxY - srcTileY);
      const srcWidth = srcEndX - srcStartX;
      const srcHeight = srcEndY - srcStartY;
      
      if (srcWidth <= 0 || srcHeight <= 0) {
        continue;
      }
      
      // Where does this go in our output (in level N pixel space)?
      const dstX = (srcTileX + srcStartX - level0MinX) / scaleFactor;
      const dstY = (srcTileY + srcStartY - level0MinY) / scaleFactor;
      const dstWidth = srcWidth / scaleFactor;
      const dstHeight = srcHeight / scaleFactor;
      
      // Draw the portion of the source tile, scaled down
      ctx.drawImage(
        sourceTile.imageBitmap,
        srcStartX, srcStartY, srcWidth, srcHeight,  // Source rect
        dstX, dstY, dstWidth, dstHeight              // Dest rect
      );
    }
    
    if (!hasAnyTile) {
      return null;
    }
    
    // Create ImageBitmap from canvas
    const imageBitmap = await createImageBitmap(canvas);
    
    // Note: Don't cache virtual tiles (level > 0) internally
    // The TileCache in TileManager handles caching for all tiles
    // We only cache level 0 tiles internally because they're needed
    // to generate virtual tiles at higher levels
    
    // Convert to full-resolution image space
    const imageX = levelTileX / levelInfo.scale;
    const imageY = levelTileY / levelInfo.scale;
    const imageWidth = tileWidth / levelInfo.scale;
    const imageHeight = tileHeight / levelInfo.scale;
    
    return {
      level,
      x,
      y,
      width: imageWidth,
      height: imageHeight,
      imageX,
      imageY,
      imageBitmap,
      loaded: true,
      visible: false,
      lastAccess: Date.now(),
    };
  }

  /**
   * Generate or get the cached overview bitmap
   * This creates a single downscaled image of the entire TIFF using just a few tiles
   */
  private async getOrCreateOverview(): Promise<ImageBitmap | null> {
    // Return cached overview if available
    if (this.overviewBitmap) {
      return this.overviewBitmap;
    }
    
    // If already generating, wait for the existing promise
    if (this.overviewGenerating && this.overviewPromise) {
      return this.overviewPromise;
    }
    
    // Start generating
    this.overviewGenerating = true;
    this.overviewPromise = this.generateOverviewBitmap();
    
    try {
      this.overviewBitmap = await this.overviewPromise;
      return this.overviewBitmap;
    } finally {
      this.overviewGenerating = false;
    }
  }
  
  /**
   * Generate an overview bitmap from a grid of level 0 tiles
   * Uses a limited number of tiles scaled up to fill the entire overview
   * This creates a rough preview quickly for high zoom-out levels
   */
  private async generateOverviewBitmap(): Promise<ImageBitmap | null> {
    const startTime = performance.now();
    const totalTiles = this.tilesAcross * this.tilesDown;
    
    // Calculate overview size - target ~512px on the longest side
    const maxOverviewSize = 512;
    const scale = Math.min(maxOverviewSize / this.width, maxOverviewSize / this.height);
    const overviewWidth = Math.ceil(this.width * scale);
    const overviewHeight = Math.ceil(this.height * scale);
    
    // Create canvas for the overview
    const canvas = new OffscreenCanvas(overviewWidth, overviewHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Determine which tiles to load
    // For small tile grids, load all. For large grids, sample evenly.
    const tileCoords: Array<{ tx: number; ty: number }> = [];
    
    if (totalTiles <= MAX_OVERVIEW_TILES) {
      // Small enough - load all tiles
      for (let ty = 0; ty < this.tilesDown; ty++) {
        for (let tx = 0; tx < this.tilesAcross; tx++) {
          tileCoords.push({ tx, ty });
        }
      }
    } else {
      // Too many tiles - sample a grid evenly
      const gridSize = Math.ceil(Math.sqrt(MAX_OVERVIEW_TILES));
      const stepX = Math.max(1, this.tilesAcross / gridSize);
      const stepY = Math.max(1, this.tilesDown / gridSize);
      
      for (let gy = 0; gy < gridSize && gy * stepY < this.tilesDown; gy++) {
        for (let gx = 0; gx < gridSize && gx * stepX < this.tilesAcross; gx++) {
          const tx = Math.min(Math.floor(gx * stepX), this.tilesAcross - 1);
          const ty = Math.min(Math.floor(gy * stepY), this.tilesDown - 1);
          tileCoords.push({ tx, ty });
        }
      }
    }
    
    // Load tiles in parallel and draw immediately after each batch
    // This prevents tiles from being evicted from cache before drawing
    const concurrency = Math.min(8, tileCoords.length);
    let hasAnyTile = false;
    
    for (let i = 0; i < tileCoords.length; i += concurrency) {
      const batch = tileCoords.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async ({ tx, ty }) => ({
          tile: await this.loadNativeTile(tx, ty),
          tx,
          ty,
        }))
      );
      
      // Draw tiles immediately after loading this batch
      for (const { tile, tx, ty } of results) {
        if (!tile || !tile.imageBitmap) continue;
        
        hasAnyTile = true;
        
        // Calculate source position in full image
        const srcX = tx * this.tileWidth;
        const srcY = ty * this.tileHeight;
        
        // Calculate destination position in overview
        const dstX = srcX * scale;
        const dstY = srcY * scale;
        const dstW = tile.imageBitmap.width * scale;
        const dstH = tile.imageBitmap.height * scale;
        
        ctx.drawImage(tile.imageBitmap, 0, 0, tile.imageBitmap.width, tile.imageBitmap.height, dstX, dstY, dstW, dstH);
      }
    }
    
    if (!hasAnyTile) {
      return null;
    }
    
    const bitmap = await createImageBitmap(canvas);
    const elapsed = performance.now() - startTime;
    console.info(`[TIFF] Overview generated: ${overviewWidth}x${overviewHeight} from ${tileCoords.length} tiles in ${elapsed.toFixed(0)}ms`);
    
    return bitmap;
  }
  
  /**
   * Generate a tile from the cached overview bitmap
   * This is MUCH faster than recursive virtual tile generation
   */
  private async generateTileFromOverview(level: number, x: number, y: number): Promise<Tile | null> {
    const levelInfo = this.levels[level];
    if (!levelInfo) return null;
    
    // Get or create the overview
    const overview = await this.getOrCreateOverview();
    if (!overview) {
      // Fallback to recursive generation if overview fails
      return this.generateVirtualTile(level, x, y);
    }
    
    // Calculate tile bounds in level coordinates
    // Use native tile dimensions for consistency
    const levelTileX = x * this.tileWidth;
    const levelTileY = y * this.tileHeight;
    const tileWidth = Math.min(this.tileWidth, levelInfo.width - levelTileX);
    const tileHeight = Math.min(this.tileHeight, levelInfo.height - levelTileY);
    
    if (tileWidth <= 0 || tileHeight <= 0) return null;
    
    // Calculate the corresponding region in the overview bitmap
    // Overview covers the full image at a fixed scale
    const overviewScaleX = overview.width / this.width;
    const overviewScaleY = overview.height / this.height;
    
    // Tile position in full image space
    const imageX = levelTileX / levelInfo.scale;
    const imageY = levelTileY / levelInfo.scale;
    const imageTileWidth = tileWidth / levelInfo.scale;
    const imageTileHeight = tileHeight / levelInfo.scale;
    
    // Source region in overview
    const srcX = imageX * overviewScaleX;
    const srcY = imageY * overviewScaleY;
    const srcW = imageTileWidth * overviewScaleX;
    const srcH = imageTileHeight * overviewScaleY;
    
    // Create tile canvas
    const canvas = new OffscreenCanvas(tileWidth, tileHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    
    // Draw the portion of overview that corresponds to this tile
    ctx.drawImage(overview, srcX, srcY, srcW, srcH, 0, 0, tileWidth, tileHeight);
    
    const imageBitmap = await createImageBitmap(canvas);
    
    return {
      level,
      x,
      y,
      width: imageTileWidth,
      height: imageTileHeight,
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
    return this.levels.length;
  }

  async getTileSize(_level: number): Promise<[number, number]> {
    // Return actual native tile dimensions
    // Virtual tiles use the same dimensions for consistency
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
    this.tileAccessOrder = [];
    
    // Close overview bitmap
    if (this.overviewBitmap) {
      this.overviewBitmap.close();
      this.overviewBitmap = null;
    }
  }
}
