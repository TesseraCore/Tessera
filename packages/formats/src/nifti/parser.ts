/**
 * NIfTI parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * NIfTI parser configuration
 */
export interface NIfTIConfig extends FormatConfig {
  /** Base URL for NIfTI files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * NIfTI parser
 */
export class NIfTIParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'nifti',
    name: 'NIfTI',
    description: 'Neuroimaging Informatics Technology Initiative format',
    mimeTypes: ['application/nifti'],
    extensions: ['nii', 'nii.gz', 'hdr', 'img'],
    supportsTiling: true,
    supportsPyramids: false,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return (
        url.endsWith('.nii') ||
        url.endsWith('.nii.gz') ||
        url.endsWith('.hdr') ||
        url.endsWith('.img')
      );
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return (
        name.endsWith('.nii') ||
        name.endsWith('.nii.gz') ||
        name.endsWith('.hdr') ||
        name.endsWith('.img')
      );
    }

    // Check NIfTI magic bytes: 0x5C1A0000 (little-endian) or 0x00001A5C (big-endian)
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 4) return false;
      const view = new DataView(source);
      const magic = view.getUint32(0, true);
      return magic === 0x5c1a0000 || magic === 0x00001a5c;
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: NIfTIConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('NIfTI parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // NIfTI tile URL pattern (adjust based on your server)
        return `${baseUrl}/tile/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // TODO: Fetch NIfTI header to get dimensions
        // For now, return placeholder
        return [0, 0];
      },
      getLevelCount: async () => {
        // NIfTI typically doesn't support pyramids
        return 1;
      },
    });
  }
}

