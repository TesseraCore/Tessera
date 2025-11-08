/**
 * NRRD parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * NRRD parser configuration
 */
export interface NRRDConfig extends FormatConfig {
  /** Base URL for NRRD files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * NRRD parser
 */
export class NRRDParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'nrrd',
    name: 'NRRD',
    description: 'Nearly Raw Raster Data format',
    mimeTypes: ['image/x-nrrd'],
    extensions: ['nrrd', 'nhdr'],
    supportsTiling: true,
    supportsPyramids: false,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.nrrd') || url.endsWith('.nhdr');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.nrrd') || name.endsWith('.nhdr');
    }

    // Check NRRD magic bytes: NRRD
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 4) return false;
      const view = new DataView(source);
      const magic = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      return magic === 'NRRD';
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: NRRDConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('NRRD parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // NRRD tile URL pattern (adjust based on your server)
        return `${baseUrl}/tile/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // TODO: Parse NRRD header to get dimensions
        // For now, return placeholder
        return [0, 0];
      },
      getLevelCount: async () => {
        // NRRD typically doesn't support pyramids
        return 1;
      },
    });
  }
}

