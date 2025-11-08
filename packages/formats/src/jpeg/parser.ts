/**
 * JPEG parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';

/**
 * JPEG parser configuration
 */
export interface JPEGConfig extends FormatConfig {
  /** Base URL for JPEG files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * JPEG parser
 */
export class JPEGParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'jpeg',
    name: 'JPEG',
    description: 'Joint Photographic Experts Group image format',
    mimeTypes: ['image/jpeg', 'image/jpg'],
    extensions: ['jpg', 'jpeg'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.jpg') || url.endsWith('.jpeg');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.jpg') || name.endsWith('.jpeg');
    }

    // Check JPEG magic bytes: FF D8 FF
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 3) return false;
      const view = new DataView(source);
      return (
        view.getUint8(0) === 0xff &&
        view.getUint8(1) === 0xd8 &&
        view.getUint8(2) === 0xff
      );
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: JPEGConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based JPEG source
      // JPEG doesn't support native tiling, so we'll create a single-tile source
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

    // Memory-based JPEG source
    if (source instanceof File || source instanceof ArrayBuffer) {
      const blob = source instanceof File ? source : new Blob([source], { type: 'image/jpeg' });
      const imageBitmap = await createImageBitmap(blob);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported JPEG source type');
  }
}

