/**
 * Base tile source implementation
 */

import type { Tile, TileSource } from '@tessera/rendering';

/**
 * Base tile source with common functionality
 */
export abstract class BaseTileSource implements TileSource {
  protected imageSize: [number, number] | null = null;
  protected levelCount = 0;
  protected tileSize: number;

  constructor(tileSize: number = 256) {
    this.tileSize = tileSize;
  }

  abstract getTile(level: number, x: number, y: number): Promise<Tile | null>;
  
  abstract getImageSize(): Promise<[number, number]>;
  
  abstract getLevelCount(): Promise<number>;
  
  async getTileSize(_level: number): Promise<[number, number]> {
    // Return standard tile size for the level
    // Individual tiles may be smaller at edges
    return [this.tileSize, this.tileSize];
  }

  destroy?(): void {
    // Override in subclasses if needed
  }
}

