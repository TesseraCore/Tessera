/**
 * JPEG XL parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';

/**
 * JPEG XL parser configuration
 */
export interface JPEGXLConfig extends FormatConfig {
  /** Base URL for JPEG XL files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * JPEG XL parser
 */
export class JPEGXLParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'jpegxl',
    name: 'JPEG XL',
    description: 'JPEG XL image format',
    mimeTypes: ['image/jxl'],
    extensions: ['jxl'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.jxl');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.jxl');
    }

    // Check JPEG XL magic bytes: FF 0A
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 2) return false;
      const view = new DataView(source);
      return view.getUint8(0) === 0xff && view.getUint8(1) === 0x0a;
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: JPEGXLConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based JPEG XL source
      return new HTTPTileSource({
        baseUrl: config?.baseUrl ?? source,
        tileSize,
        headers: config?.headers,
        getTileUrl: () => source, // Single image URL
        getImageSize: async () => {
          // Load image to get dimensions
          // Note: Browser support for JPEG XL is limited
          const img = new Image();
          img.src = source;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            // Timeout after 5 seconds
            setTimeout(() => reject(new Error('Timeout')), 5000);
          });
          return [img.width, img.height];
        },
        getLevelCount: async () => 1,
      });
    }

    // Memory-based JPEG XL source
    if (source instanceof File || source instanceof ArrayBuffer) {
      const blob = source instanceof File ? source : new Blob([source], { type: 'image/jxl' });
      const imageBitmap = await createImageBitmap(blob);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported JPEG XL source type');
  }
}

