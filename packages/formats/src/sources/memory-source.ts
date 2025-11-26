/**
 * In-memory tile source for pre-loaded images
 * 
 * This tile source handles images loaded into memory (as ImageBitmap, ImageData, or ArrayBuffer).
 * It supports:
 * 1. Dynamic pyramid generation - automatically creates lower resolution levels
 * 2. Tiled mode: The image is sliced into tiles on-demand
 * 3. Progressive loading: Lower resolution tiles available while higher res loads
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
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Number of pyramid levels (default: auto-calculated) */
  levelCount?: number;
  /** MIME type (for ArrayBuffer) */
  mimeType?: string;
  /** Whether to generate pyramid levels dynamically (default: true) */
  generatePyramid?: boolean;
}

/**
 * Pyramid level info
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
  /** Cached downscaled image for this level (generated on-demand) */
  bitmap?: ImageBitmap;
}

/**
 * In-memory tile source with dynamic pyramid generation
 */
export class MemoryTileSource extends BaseTileSource {
  private imageData: ImageBitmap | ImageData | ArrayBuffer;
  private width: number;
  private height: number;
  private mimeType?: string;
  private imageBitmap: ImageBitmap | null = null;
  private generatePyramid: boolean;
  
  // Pyramid structure
  private levels: PyramidLevel[] = [];
  
  // Tile cache: key = "level:x:y"
  private tileCache = new Map<string, ImageBitmap>();
  
  // Track which pyramid levels are being generated
  private pyramidGenerating = new Map<number, Promise<ImageBitmap | null>>();

  constructor(options: MemoryTileSourceOptions) {
    super(options.tileSize ?? 256);
    this.imageData = options.imageData;
    this.width = options.width;
    this.height = options.height;
    this.mimeType = options.mimeType;
    this.generatePyramid = options.generatePyramid ?? true;
    
    // If already an ImageBitmap, use it directly
    if (this.imageData instanceof ImageBitmap) {
      this.imageBitmap = this.imageData;
    }
    
    // Calculate pyramid levels
    this.initializePyramid(options.levelCount);
  }

  /**
   * Initialize pyramid level structure
   * 
   * We generate enough levels so the smallest level fits in roughly one tile.
   * Each level is 1/2 the resolution of the previous level.
   */
  private initializePyramid(explicitLevelCount?: number): void {
    const minDimension = Math.min(this.width, this.height);
    
    // Calculate how many levels we need
    // Stop when the smallest dimension would be <= tileSize
    let levelCount: number;
    if (explicitLevelCount !== undefined) {
      levelCount = explicitLevelCount;
    } else if (this.generatePyramid) {
      // Auto-calculate: enough levels so smallest fits in ~1-2 tiles
      levelCount = Math.max(1, Math.ceil(Math.log2(minDimension / this.tileSize)) + 1);
    } else {
      levelCount = 1;
    }
    
    // Create level info
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
        tilesAcross: Math.ceil(levelWidth / this.tileSize),
        tilesDown: Math.ceil(levelHeight / this.tileSize),
      });
    }
  }

  /**
   * Ensure the source ImageBitmap is available (level 0)
   */
  private async ensureImageBitmap(): Promise<ImageBitmap | null> {
    if (this.imageBitmap) {
      return this.imageBitmap;
    }

    if (this.imageData instanceof ArrayBuffer) {
      const isTIFF = this.mimeType === 'image/tiff' || this.mimeType === 'image/tif';
      
      if (isTIFF) {
        const view = new DataView(this.imageData);
        if (this.imageData.byteLength >= 4) {
          const byte0 = view.getUint8(0);
          const byte1 = view.getUint8(1);
          const isTIFFFile = (byte0 === 0x49 && byte1 === 0x49) || (byte0 === 0x4d && byte1 === 0x4d);
          
          if (isTIFFFile) {
            throw new Error(
              'TIFF files cannot be decoded directly in the browser. ' +
              'Use the TIFF parser which handles decoding.'
            );
          }
        }
      }
      
      try {
        const blob = new Blob([this.imageData], { type: this.mimeType || 'image/png' });
        this.imageBitmap = await createImageBitmap(blob);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isTIFF) {
          throw new Error(`TIFF decoding failed: ${errorMessage}`);
        }
        console.error('Failed to create ImageBitmap from ArrayBuffer:', error);
        throw error;
      }
    } else if (this.imageData instanceof ImageData) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = this.imageData.width;
        canvas.height = this.imageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(this.imageData, 0, 0);
          this.imageBitmap = await createImageBitmap(canvas);
        }
      } catch (error) {
        console.error('[MemoryTileSource] Failed to create ImageBitmap from ImageData:', error);
        return null;
      }
    }

    // Store level 0 bitmap
    if (this.imageBitmap && this.levels[0]) {
      this.levels[0].bitmap = this.imageBitmap;
    }

    return this.imageBitmap;
  }

  /**
   * Get or generate the bitmap for a pyramid level
   */
  private async getPyramidLevelBitmap(level: number): Promise<ImageBitmap | null> {
    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }
    
    // Check if already generated
    if (levelInfo.bitmap) {
      return levelInfo.bitmap;
    }
    
    // Level 0 is the source
    if (level === 0) {
      return this.ensureImageBitmap();
    }
    
    // Check if generation is in progress
    const existingPromise = this.pyramidGenerating.get(level);
    if (existingPromise) {
      return existingPromise;
    }
    
    // Generate downscaled version
    const generatePromise = this.generatePyramidLevel(level);
    this.pyramidGenerating.set(level, generatePromise);
    
    try {
      const bitmap = await generatePromise;
      levelInfo.bitmap = bitmap ?? undefined;
      return bitmap;
    } finally {
      this.pyramidGenerating.delete(level);
    }
  }

  /**
   * Generate a pyramid level by downscaling from the previous level
   */
  private async generatePyramidLevel(level: number): Promise<ImageBitmap | null> {
    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }
    
    // Get the source - prefer previous level (faster), fallback to level 0
    let sourceBitmap: ImageBitmap | null = null;
    let sourceLevel = level - 1;
    
    // Try to use the immediately previous level if available
    while (sourceLevel >= 0) {
      const sourceLevelInfo = this.levels[sourceLevel];
      if (sourceLevelInfo?.bitmap) {
        sourceBitmap = sourceLevelInfo.bitmap;
        break;
      }
      sourceLevel--;
    }
    
    // Fallback to level 0
    if (!sourceBitmap) {
      sourceBitmap = await this.ensureImageBitmap();
    }
    
    if (!sourceBitmap) {
      return null;
    }
    
    try {
      // Create downscaled version using canvas
      const canvas = document.createElement('canvas');
      canvas.width = levelInfo.width;
      canvas.height = levelInfo.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return null;
      }
      
      // Enable smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw scaled image
      ctx.drawImage(sourceBitmap, 0, 0, levelInfo.width, levelInfo.height);
      
      // Create ImageBitmap from canvas
      const bitmap = await createImageBitmap(canvas);
      return bitmap;
    } catch (error) {
      console.error(`[MemoryTileSource] Failed to generate pyramid level ${level}:`, error);
      return null;
    }
  }

  /**
   * Extract a tile from a pyramid level
   */
  private async extractTile(level: number, x: number, y: number): Promise<ImageBitmap | null> {
    const cacheKey = `${level}:${x}:${y}`;
    
    // Check cache first
    const cached = this.tileCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }

    const sourceBitmap = await this.getPyramidLevelBitmap(level);
    if (!sourceBitmap) {
      return null;
    }

    // Calculate tile bounds in level space
    const tileX = x * this.tileSize;
    const tileY = y * this.tileSize;
    
    // Handle edge tiles (may be smaller than tileSize)
    const tileWidth = Math.min(this.tileSize, levelInfo.width - tileX);
    const tileHeight = Math.min(this.tileSize, levelInfo.height - tileY);
    
    // Validate bounds
    if (tileWidth <= 0 || tileHeight <= 0 || tileX >= levelInfo.width || tileY >= levelInfo.height) {
      return null;
    }

    try {
      // Extract tile region from source bitmap
      const tileBitmap = await createImageBitmap(
        sourceBitmap,
        tileX,
        tileY,
        tileWidth,
        tileHeight
      );
      
      // Cache the extracted tile
      this.tileCache.set(cacheKey, tileBitmap);
      
      return tileBitmap;
    } catch (error) {
      console.error(`[MemoryTileSource] Failed to extract tile (${level}, ${x}, ${y}):`, error);
      return null;
    }
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    const levelInfo = this.levels[level];
    if (!levelInfo) {
      return null;
    }
    
    // Validate tile coordinates
    if (x < 0 || x >= levelInfo.tilesAcross || y < 0 || y >= levelInfo.tilesDown) {
      return null;
    }

    // Calculate tile position and dimensions in level space
    const levelTileX = x * this.tileSize;
    const levelTileY = y * this.tileSize;
    const tileWidth = Math.min(this.tileSize, levelInfo.width - levelTileX);
    const tileHeight = Math.min(this.tileSize, levelInfo.height - levelTileY);
    
    // Extract the tile
    const tileBitmap = await this.extractTile(level, x, y);
    
    if (!tileBitmap) {
      return null;
    }

    // Calculate position in full-resolution image space
    // The tile at level N covers an area 2^N times larger in image space
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
      imageBitmap: tileBitmap,
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
    return [this.tileSize, this.tileSize];
  }

  /**
   * Get info about a pyramid level
   */
  getLevelInfo(level: number): PyramidLevel | null {
    return this.levels[level] ?? null;
  }

  /**
   * Get the number of tiles across (horizontal) at a level
   */
  getTilesAcross(level: number = 0): number {
    return this.levels[level]?.tilesAcross ?? 0;
  }

  /**
   * Get the number of tiles down (vertical) at a level
   */
  getTilesDown(level: number = 0): number {
    return this.levels[level]?.tilesDown ?? 0;
  }

  /**
   * Pre-generate all pyramid levels
   * Call this for faster first-time access to lower resolution tiles
   */
  async preGeneratePyramid(): Promise<void> {
    for (let i = 0; i < this.levels.length; i++) {
      await this.getPyramidLevelBitmap(i);
    }
  }

  /**
   * Check if a pyramid level bitmap is ready
   */
  isLevelReady(level: number): boolean {
    return this.levels[level]?.bitmap !== undefined;
  }

  destroy(): void {
    // Close all cached tiles
    for (const bitmap of this.tileCache.values()) {
      bitmap.close();
    }
    this.tileCache.clear();
    
    // Close pyramid level bitmaps (except level 0 if it's the source)
    for (let i = 1; i < this.levels.length; i++) {
      const level = this.levels[i];
      if (level?.bitmap) {
        level.bitmap.close();
        level.bitmap = undefined;
      }
    }
    
    // Only close the source bitmap if we created it ourselves
    if (this.imageBitmap && !(this.imageData instanceof ImageBitmap)) {
      this.imageBitmap.close();
      this.imageBitmap = null;
    }
  }
}
