/**
 * PNG parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';

/**
 * PNG parser configuration
 */
export interface PNGConfig extends FormatConfig {
  /** Base URL for PNG files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * PNG parser
 */
export class PNGParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'png',
    name: 'PNG',
    description: 'Portable Network Graphics image format',
    mimeTypes: ['image/png'],
    extensions: ['png'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.png');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.png');
    }

    // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 8) return false;
      const view = new DataView(source);
      return (
        view.getUint8(0) === 0x89 &&
        view.getUint8(1) === 0x50 &&
        view.getUint8(2) === 0x4e &&
        view.getUint8(3) === 0x47 &&
        view.getUint8(4) === 0x0d &&
        view.getUint8(5) === 0x0a &&
        view.getUint8(6) === 0x1a &&
        view.getUint8(7) === 0x0a
      );
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: PNGConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based PNG source
      // PNG doesn't support native tiling, so we'll create a single-tile source
      return new HTTPTileSource({
        baseUrl: config?.baseUrl ?? source,
        tileSize,
        headers: config?.headers,
        getTileUrl: () => source, // Single image URL
        getImageSize: async () => {
          // Load image to get dimensions
          const img = new Image();
          img.src = source;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          return [img.width, img.height];
        },
        getLevelCount: async () => 1,
      });
    }

    // Memory-based PNG source
    if (source instanceof File || source instanceof ArrayBuffer) {
      const blob = source instanceof File ? source : new Blob([source], { type: 'image/png' });
      const imageBitmap = await createImageBitmap(blob);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported PNG source type');
  }
}

