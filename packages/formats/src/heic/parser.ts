/**
 * HEIC/HEIF parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';

/**
 * HEIC parser configuration
 */
export interface HEICConfig extends FormatConfig {
  /** Base URL for HEIC files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * HEIC/HEIF parser
 */
export class HEICParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'heic',
    name: 'HEIC/HEIF',
    description: 'High Efficiency Image Container/Format',
    mimeTypes: ['image/heic', 'image/heif'],
    extensions: ['heic', 'heif', 'hif'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.heic') || url.endsWith('.heif') || url.endsWith('.hif');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.heic') || name.endsWith('.heif') || name.endsWith('.hif');
    }

    // Check HEIC/HEIF magic bytes: ftyp box with heic/heif brand
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 12) return false;
      const view = new DataView(source);
      // Check for 'ftyp' at offset 4
      const ftyp = String.fromCharCode(
        view.getUint8(4),
        view.getUint8(5),
        view.getUint8(6),
        view.getUint8(7)
      );
      if (ftyp !== 'ftyp') return false;
      
      // Check for HEIC/HEIF brand at offset 8
      const brand = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      return brand === 'heic' || brand === 'heif' || brand === 'mif1';
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: HEICConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based HEIC source
      return new HTTPTileSource({
        baseUrl: config?.baseUrl ?? source,
        tileSize,
        headers: config?.headers,
        getTileUrl: () => source, // Single image URL
        getImageSize: async () => {
          // Load image to get dimensions
          // Note: Browser support for HEIC is limited
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

    // Memory-based HEIC source
    if (source instanceof File || source instanceof ArrayBuffer) {
      const blob = source instanceof File ? source : new Blob([source], { type: 'image/heic' });
      const imageBitmap = await createImageBitmap(blob);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported HEIC source type');
  }
}

