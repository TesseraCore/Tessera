/**
 * IIIF Image API parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';

/**
 * IIIF parser configuration
 */
export interface IIIFConfig extends FormatConfig {
  /** IIIF Image API version (default: 3) */
  version?: 2 | 3;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * IIIF Image API parser
 */
export class IIIFParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'iiif',
    name: 'IIIF Image API',
    description: 'International Image Interoperability Framework Image API',
    mimeTypes: ['application/json'],
    extensions: ['json'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      // Check if URL looks like IIIF info.json or image URL
      const url = source.toLowerCase();
      return (
        url.includes('/iiif/') ||
        url.endsWith('/info.json') ||
        url.match(/\/iiif\/\d+\/[^\/]+\/info\.json$/) !== null
      );
    }

    if (source instanceof File) {
      return source.name.toLowerCase().endsWith('info.json');
    }

    // Check if ArrayBuffer contains IIIF info.json
    if (source instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(source.slice(0, 100));
        return text.includes('"@context"') || text.includes('"protocol"');
      } catch {
        return false;
      }
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: IIIFConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('IIIF parser only supports URL sources');
    }

    const version = config?.version ?? 3;
    const tileSize = config?.tileSize ?? 256;
    
    // Get IIIF info.json URL
    let infoUrl = source;
    if (!infoUrl.endsWith('/info.json')) {
      if (infoUrl.endsWith('/')) {
        infoUrl += 'info.json';
      } else {
        infoUrl += '/info.json';
      }
    }

    // Fetch info.json
    const response = await fetch(infoUrl, { headers: config?.headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch IIIF info: ${response.statusText}`);
    }

    const info = await response.json();
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    
    // Calculate pyramid levels
    const maxDim = Math.max(width, height);
    const levelCount = Math.ceil(Math.log2(maxDim / tileSize)) + 1;

    // Extract base URL (everything before /info.json)
    const baseUrl = infoUrl.replace('/info.json', '');

    return new HTTPTileSource({
      baseUrl,
      tileSize,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        const scale = Math.pow(2, levelCount - 1 - level);
        const levelWidth = Math.ceil(width * scale);
        const levelHeight = Math.ceil(height * scale);
        
        const tileX = x * tileSize;
        const tileY = y * tileSize;
        const tileWidth = Math.min(tileSize, levelWidth - tileX);
        const tileHeight = Math.min(tileSize, levelHeight - tileY);

        if (version === 3) {
          // IIIF Image API 3.0
          return `${baseUrl}/${tileX},${tileY},${tileWidth},${tileHeight}/${Math.round(levelWidth)}/0/default.jpg`;
        } else {
          // IIIF Image API 2.1
          return `${baseUrl}/${tileX},${tileY},${tileWidth},${tileHeight}/${Math.round(levelWidth)}/0/native.jpg`;
        }
      },
      getImageSize: async () => [width, height],
      getLevelCount: async () => levelCount,
    });
  }
}

