/**
 * SCN (Leica SCN) parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * SCN parser configuration
 */
export interface SCNConfig extends FormatConfig {
  /** Base URL for SCN files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * SCN parser
 */
export class SCNParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'scn',
    name: 'SCN',
    description: 'Leica SCN (Scan) format',
    mimeTypes: ['application/x-scn'],
    extensions: ['scn'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.scn');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.scn');
    }

    // SCN files are TIFF-based, check TIFF magic bytes
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 4) return false;
      const view = new DataView(source);
      const byte0 = view.getUint8(0);
      const byte1 = view.getUint8(1);
      const byte2 = view.getUint16(2, true);
      return (
        (byte0 === 0x49 && byte1 === 0x49 && byte2 === 42) ||
        (byte0 === 0x4d && byte1 === 0x4d && byte2 === 42)
      );
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: SCNConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('SCN parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // SCN tile URL pattern (adjust based on your server)
        return `${baseUrl}/tile/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // TODO: Parse SCN header to get dimensions
        return [0, 0];
      },
      getLevelCount: async () => {
        // TODO: Parse SCN to get pyramid levels
        return 1;
      },
    });
  }
}

