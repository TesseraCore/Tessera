/**
 * gRPC API tile source
 * Note: gRPC typically requires special client libraries and protocol buffers.
 * This is a simplified implementation that works with gRPC-Web or gRPC-HTTP/JSON.
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from '../sources/base-source.js';
import type { APITileSourceConfig, URLTemplate } from './types.js';
import { parseURLTemplate, URLTemplates } from './url-templates.js';

/**
 * gRPC tile source configuration
 */
export interface GRPCTileSourceConfig extends APITileSourceConfig {
  /** gRPC service name */
  service?: string;
  /** gRPC method for getting tile */
  tileMethod?: string;
  /** gRPC method for getting metadata */
  metadataMethod?: string;
  /** Use gRPC-Web (true) or gRPC-HTTP/JSON (false) */
  useGRPCWeb?: boolean;
}

/**
 * gRPC API tile source
 * Note: Full gRPC support requires protocol buffers and a gRPC client library.
 * This implementation works with gRPC-HTTP/JSON transcoding.
 */
export class GRPCTileSource extends BaseTileSource {
  private baseUrl: string;
  private urlGenerator: URLTemplate;
  private headers: Record<string, string>;
  private service: string;
  private tileMethod: string;
  private metadataMethod: string;
  private useGRPCWeb: boolean;

  constructor(config: GRPCTileSourceConfig) {
    super(config.tileSize);
    this.baseUrl = config.baseUrl;
    this.headers = this.buildHeaders(config);
    this.service = config.service ?? 'TileService';
    this.tileMethod = config.tileMethod ?? 'GetTile';
    this.metadataMethod = config.metadataMethod ?? 'GetMetadata';
    this.useGRPCWeb = config.useGRPCWeb ?? false;
    
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
      // Default: use gRPC-HTTP/JSON transcoding pattern
      this.urlGenerator = (params) => {
        if (this.useGRPCWeb) {
          // gRPC-Web uses POST with protobuf
          return `${this.baseUrl}/${this.service}/${this.tileMethod}`;
        } else {
          // gRPC-HTTP/JSON transcoding uses REST-like URLs
          return `${this.baseUrl}/${this.service}/${this.tileMethod}?level=${params.level}&x=${params.x}&y=${params.y}`;
        }
      };
    }
  }

  private buildHeaders(config: APITileSourceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': this.useGRPCWeb ? 'application/grpc-web+proto' : 'application/json',
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
            const customHeaders = config.auth.customAuth({ headers });
            return { ...headers, ...customHeaders };
          }
          break;
      }
    }

    return headers;
  }

  private async callGRPC(method: string, request: any): Promise<any> {
    let url = `${this.baseUrl}/${this.service}/${method}`;
    
    const options: RequestInit = {
      method: this.useGRPCWeb ? 'POST' : 'GET',
      headers: this.headers,
    };

    if (this.useGRPCWeb) {
      // gRPC-Web requires protobuf encoding (simplified here)
      // In production, use a proper gRPC-Web client library
      options.body = JSON.stringify(request);
    } else {
      // gRPC-HTTP/JSON transcoding
      if (method === this.tileMethod) {
        url += `?level=${request.level}&x=${request.x}&y=${request.y}`;
      }
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`gRPC call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    try {
      // Try gRPC call first
      const result = await this.callGRPC(this.tileMethod, { level, x, y });
      
      if (result?.url) {
        // Fetch tile from URL returned by gRPC
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
      console.error(`Failed to load tile via gRPC ${level}/${x}/${y}:`, error);
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
      const result = await this.callGRPC(this.metadataMethod, {});
      if (result) {
        return [result.width ?? 0, result.height ?? 0];
      }
    } catch (error) {
      console.error('Failed to fetch metadata via gRPC:', error);
    }
    
    return [0, 0];
  }

  async getLevelCount(): Promise<number> {
    try {
      const result = await this.callGRPC(this.metadataMethod, {});
      if (result) {
        return result.levels ?? result.levelCount ?? 1;
      }
    } catch (error) {
      console.error('Failed to fetch metadata via gRPC:', error);
    }
    
    return 1;
  }
}

