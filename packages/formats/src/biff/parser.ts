/**
 * BIFF (Bio-Image File Format) parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * BIFF parser configuration
 */
export interface BIFFConfig extends FormatConfig {
  /** Base URL for BIFF files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * BIFF parser
 */
export class BIFFParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'biff',
    name: 'BIFF',
    description: 'Bio-Image File Format',
    mimeTypes: ['application/x-biff'],
    extensions: ['biff', 'bf'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.biff') || url.endsWith('.bf');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.biff') || name.endsWith('.bf');
    }

    // Check BIFF magic bytes: BIFF
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 4) return false;
      const view = new DataView(source);
      const magic = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      return magic === 'BIFF';
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: BIFFConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('BIFF parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // BIFF tile URL pattern
        return `${baseUrl}/tiles/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // TODO: Fetch BIFF metadata to get dimensions
        const response = await fetch(`${baseUrl}/metadata`, {
          headers: config?.headers,
        });
        if (response.ok) {
          const metadata = await response.json();
          return [metadata.width ?? 0, metadata.height ?? 0];
        }
        return [0, 0];
      },
      getLevelCount: async () => {
        // TODO: Fetch BIFF metadata to get pyramid levels
        const response = await fetch(`${baseUrl}/metadata`, {
          headers: config?.headers,
        });
        if (response.ok) {
          const metadata = await response.json();
          return metadata.levels ?? 1;
        }
        return 1;
      },
    });
  }
}

