/**
 * Zarr array parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * Zarr parser configuration
 */
export interface ZarrConfig extends FormatConfig {
  /** Base URL for Zarr store */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Array name within Zarr store */
  arrayName?: string;
}

/**
 * Zarr array parser
 */
export class ZarrParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'zarr',
    name: 'Zarr',
    description: 'Zarr array format for chunked arrays',
    mimeTypes: ['application/x-zarr'],
    extensions: ['zarr'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.includes('.zarr') || url.endsWith('.zarr');
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('.zarr');
    }

    // Check for .zarray metadata file
    if (source instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(source.slice(0, 100));
        return text.includes('"zarr_format"');
      } catch {
        return false;
      }
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: ZarrConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('Zarr parser only supports URL sources');
    }

    const baseUrl = config?.baseUrl ?? source;
    const tileSize = config?.tileSize ?? 256;
    const arrayName = config?.arrayName ?? '0';

    // Fetch .zarray metadata
    const metadataUrl = `${baseUrl}/${arrayName}/.zarray`;
    const response = await fetch(metadataUrl, { headers: config?.headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Zarr metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    const shape = metadata.shape ?? [];
    const chunks = metadata.chunks ?? [256, 256];
    
    const width = shape[shape.length - 1] ?? 0;
    const height = shape[shape.length - 2] ?? 0;
    
    // Calculate pyramid levels
    const maxDim = Math.max(width, height);
    const levelCount = Math.ceil(Math.log2(maxDim / tileSize)) + 1;

    return new HTTPTileSource({
      baseUrl: `${baseUrl}/${arrayName}`,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        // Zarr chunk path format: 0.0, 0.1, etc.
        const chunkX = Math.floor(x * tileSize / chunks[0]!);
        const chunkY = Math.floor(y * tileSize / chunks[1]!);
        return `${baseUrl}/${arrayName}/${level}/${chunkY}.${chunkX}`;
      },
      getImageSize: async () => [width, height],
      getLevelCount: async () => levelCount,
    });
  }
}

