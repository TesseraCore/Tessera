/**
 * WebP parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';

/**
 * WebP parser configuration
 */
export interface WebPConfig extends FormatConfig {
  /** Base URL for WebP files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * WebP parser
 */
export class WebPParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'webp',
    name: 'WebP',
    description: 'WebP image format',
    mimeTypes: ['image/webp'],
    extensions: ['webp'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.webp');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.webp');
    }

    // Check WebP magic bytes: RIFF....WEBP
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 12) return false;
      const view = new DataView(source);
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      const webp = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      return riff === 'RIFF' && webp === 'WEBP';
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: WebPConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based WebP source
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

    // Memory-based WebP source
    if (source instanceof File || source instanceof ArrayBuffer) {
      const blob = source instanceof File ? source : new Blob([source], { type: 'image/webp' });
      const imageBitmap = await createImageBitmap(blob);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported WebP source type');
  }
}

