/**
 * DICOM parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * DICOM parser configuration
 */
export interface DICOMConfig extends FormatConfig {
  /** Base URL for DICOM files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Series instance UID */
  seriesInstanceUID?: string;
}

/**
 * DICOM parser
 */
export class DICOMParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'dicom',
    name: 'DICOM',
    description: 'Digital Imaging and Communications in Medicine',
    mimeTypes: ['application/dicom'],
    extensions: ['dcm', 'dicom'],
    supportsTiling: true,
    supportsPyramids: false,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.dcm') || url.endsWith('.dicom');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.dcm') || name.endsWith('.dicom');
    }

    // Check DICOM magic bytes: DICM at offset 128
    if (source instanceof ArrayBuffer) {
      if (source.byteLength < 132) return false;
      const view = new DataView(source);
      const magic = String.fromCharCode(
        view.getUint8(128),
        view.getUint8(129),
        view.getUint8(130),
        view.getUint8(131)
      );
      return magic === 'DICM';
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: DICOMConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based DICOM source
      const baseUrl = config?.baseUrl ?? source;
      
      return new HTTPTileSource({
        baseUrl,
        tileSize,
        headers: {
          'Accept': 'application/dicom',
          ...config?.headers,
        },
        getTileUrl: (level, x, y) => {
          // DICOM tile URL pattern (adjust based on your server)
          // Many DICOM servers use WADO-URI or WADO-RS
          if (config?.seriesInstanceUID) {
            return `${baseUrl}/series/${config.seriesInstanceUID}/tile/${level}/${x}/${y}`;
          }
          return `${baseUrl}/tile/${level}/${x}/${y}`;
        },
        getImageSize: async () => {
          // TODO: Fetch DICOM metadata to get dimensions
          // For now, return placeholder
          return [0, 0];
        },
        getLevelCount: async () => {
          // DICOM typically doesn't support pyramids
          return 1;
        },
      });
    }

    // Memory-based DICOM source
    // TODO: Parse DICOM from ArrayBuffer/File
    throw new Error('DICOM parsing from ArrayBuffer/File not yet implemented');
  }
}

