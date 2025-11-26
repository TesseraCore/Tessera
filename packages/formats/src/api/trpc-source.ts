/**
 * tRPC API tile source
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from '../sources/base-source.js';
import type { APITileSourceConfig, URLTemplate } from './types.js';
import { parseURLTemplate } from './url-templates.js';

/**
 * tRPC tile source configuration
 */
export interface TRPCTileSourceConfig extends APITileSourceConfig {
  /** tRPC procedure path for getting tile */
  tileProcedure?: string;
  /** tRPC procedure path for getting metadata */
  metadataProcedure?: string;
  /** tRPC batch endpoint */
  batchEndpoint?: string;
}

/**
 * tRPC API tile source
 */
export class TRPCTileSource extends BaseTileSource {
  private baseUrl: string;
  private urlGenerator: URLTemplate;
  private headers: Record<string, string>;
  private tileProcedure: string;
  private metadataProcedure: string;
  private batchEndpoint: string;

  constructor(config: TRPCTileSourceConfig) {
    super(config.tileSize);
    this.baseUrl = config.baseUrl;
    this.headers = this.buildHeaders(config);
    this.tileProcedure = config.tileProcedure ?? 'tile.get';
    this.metadataProcedure = config.metadataProcedure ?? 'metadata.get';
    this.batchEndpoint = config.batchEndpoint ?? '/api/trpc';
    
    // Set up URL generator
    if (config.urlGenerator) {
      this.urlGenerator = config.urlGenerator;
    } else if (config.urlTemplate) {
      if (typeof config.urlTemplate === 'string') {
        this.urlGenerator = parseURLTemplate(config.urlTemplate);
      } else {
        this.urlGenerator = config.urlTemplate;
      }
    } else {
      // Default: use tRPC endpoint
      this.urlGenerator = (params) => {
        return `${this.baseUrl}${this.batchEndpoint}/${this.tileProcedure}?input=${encodeURIComponent(JSON.stringify({ level: params.level, x: params.x, y: params.y }))}`;
      };
    }
  }

  private buildHeaders(config: APITileSourceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Add authentication headers
    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          if (config.auth.token) {
            headers['Authorization'] = `Bearer ${config.auth.token}`;
          }
          break;
        case 'basic':
          if (config.auth.username && config.auth.password) {
            const credentials = btoa(`${config.auth.username}:${config.auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'api-key':
          if (config.auth.apiKey) {
            const headerName = config.auth.apiKeyHeader ?? 'X-API-Key';
            headers[headerName] = config.auth.apiKey;
          }
          break;
        case 'custom':
          if (config.auth.customAuth) {
            const customConfig = config.auth.customAuth({ headers });
            return { ...headers, ...customConfig.headers };
          }
          break;
      }
    }

    return headers;
  }

  private async callProcedure(procedure: string, input: any): Promise<any> {
    const url = `${this.baseUrl}${this.batchEndpoint}/${procedure}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      throw new Error(`tRPC procedure failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.result?.data ?? result;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    try {
      // Try tRPC procedure first
      const result = await this.callProcedure(this.tileProcedure, { level, x, y });
      
      if (result?.url) {
        // Fetch tile from URL returned by tRPC
        const tileResponse = await fetch(result.url, {
          headers: this.headers,
        });
        
        if (!tileResponse.ok) {
          return null;
        }

        const blob = await tileResponse.blob();
        const imageBitmap = await createImageBitmap(blob);
        
        const [imageWidth, imageHeight] = await this.getImageSize();
        const levelCount = await this.getLevelCount();
        const scale = Math.pow(2, levelCount - 1 - level);
        
        const tileX = x * this.tileSize;
        const tileY = y * this.tileSize;
        const levelWidth = Math.ceil(imageWidth * scale);
        const levelHeight = Math.ceil(imageHeight * scale);
        
        const tileWidth = Math.min(this.tileSize, levelWidth - tileX);
        const tileHeight = Math.min(this.tileSize, levelHeight - tileY);

        return {
          level,
          x,
          y,
          width: tileWidth,
          height: tileHeight,
          imageX: Math.floor(tileX / scale),
          imageY: Math.floor(tileY / scale),
          imageBitmap,
          loaded: true,
          visible: false,
          lastAccess: Date.now(),
        };
      }
    } catch (error) {
      console.error(`Failed to load tile via tRPC ${level}/${x}/${y}:`, error);
    }

    // Fallback to URL generator
    const url = this.urlGenerator({
      level,
      x,
      y,
      tileSize: this.tileSize,
      baseUrl: this.baseUrl,
    });

    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      
      const [imageWidth, imageHeight] = await this.getImageSize();
      const levelCount = await this.getLevelCount();
      const scale = Math.pow(2, levelCount - 1 - level);
      
      const tileX = x * this.tileSize;
      const tileY = y * this.tileSize;
      const levelWidth = Math.ceil(imageWidth * scale);
      const levelHeight = Math.ceil(imageHeight * scale);
      
      const tileWidth = Math.min(this.tileSize, levelWidth - tileX);
      const tileHeight = Math.min(this.tileSize, levelHeight - tileY);

      return {
        level,
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        imageX: Math.floor(tileX / scale),
        imageY: Math.floor(tileY / scale),
        imageBitmap,
        loaded: true,
        visible: false,
        lastAccess: Date.now(),
      };
    } catch (error) {
      console.error(`Failed to load tile ${level}/${x}/${y}:`, error);
      return null;
    }
  }

  getTileUrl(level: number, x: number, y: number): string {
    return this.urlGenerator({
      level,
      x,
      y,
      tileSize: this.tileSize,
      baseUrl: this.baseUrl,
    });
  }

  async getImageSize(): Promise<[number, number]> {
    try {
      const result = await this.callProcedure(this.metadataProcedure, {});
      if (result) {
        return [result.width ?? 0, result.height ?? 0];
      }
    } catch (error) {
      console.error('Failed to fetch metadata via tRPC:', error);
    }
    
    return [0, 0];
  }

  async getLevelCount(): Promise<number> {
    try {
      const result = await this.callProcedure(this.metadataProcedure, {});
      if (result) {
        return result.levels ?? result.levelCount ?? 1;
      }
    } catch (error) {
      console.error('Failed to fetch metadata via tRPC:', error);
    }
    
    return 1;
  }
}

