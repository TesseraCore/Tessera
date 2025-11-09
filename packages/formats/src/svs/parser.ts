/**
 * SVS (Aperio ScanScope Virtual Slide) parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * SVS parser configuration
 */
export interface SVSConfig extends FormatConfig {
  /** Base URL for SVS files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * SVS parser
 */
export class SVSParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'svs',
    name: 'SVS',
    description: 'Aperio ScanScope Virtual Slide format',
    mimeTypes: ['application/x-svs'],
    extensions: ['svs'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.svs');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.svs');
    }

    // SVS files are TIFF-based, check TIFF magic bytes
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
    config?: SVSConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('SVS parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // SVS tile URL pattern (adjust based on your server)
        // SVS files are TIFF-based and support tiling
        return `${baseUrl}/tile/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // TODO: Parse SVS/TIFF header to get dimensions
        return [0, 0];
      },
      getLevelCount: async () => {
        // TODO: Parse SVS to get pyramid levels
        return 1;
      },
    });
  }
}

