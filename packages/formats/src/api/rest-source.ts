/**
 * REST API tile source
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from '../sources/base-source.js';
import type { APITileSourceConfig, URLTemplate } from './types.js';
import { parseURLTemplate, URLTemplates } from './url-templates.js';

/**
 * REST API tile source
 */
export class RESTTileSource extends BaseTileSource {
  private baseUrl: string;
  private urlGenerator: URLTemplate;
  private headers: Record<string, string>;
  private endpoints: APITileSourceConfig['endpoints'];
  private requestConfig: APITileSourceConfig['requestConfig'];

  constructor(config: APITileSourceConfig) {
    super(config.tileSize);
    this.baseUrl = config.baseUrl;
    this.headers = this.buildHeaders(config);
    this.endpoints = config.endpoints;
    this.requestConfig = config.requestConfig;
    
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
      // Default to standard template
      this.urlGenerator = URLTemplates.standard;
    }
  }

  private buildHeaders(config: APITileSourceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'image/*',
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

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    const url = this.getTileUrl(level, x, y);
    
    try {
      const method = this.requestConfig?.method ?? 'GET';
      const requestHeaders = {
        ...this.headers,
        ...this.requestConfig?.headers,
      };

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
      };

      if (method === 'POST' && this.requestConfig?.body) {
        fetchOptions.body = JSON.stringify(this.requestConfig.body);
        requestHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, fetchOptions);

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
    if (this.endpoints?.imageSize) {
      try {
        const response = await fetch(`${this.baseUrl}${this.endpoints.imageSize}`, {
          headers: this.headers,
        });
        if (response.ok) {
          const data = await response.json();
          return [data.width ?? 0, data.height ?? 0];
        }
      } catch (error) {
        console.error('Failed to fetch image size:', error);
      }
    }
    
    // Fallback: try to get from metadata endpoint
    if (this.endpoints?.metadata) {
      try {
        const response = await fetch(`${this.baseUrl}${this.endpoints.metadata}`, {
          headers: this.headers,
        });
        if (response.ok) {
          const data = await response.json();
          return [data.width ?? 0, data.height ?? 0];
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    }
    
    return [0, 0];
  }

  async getLevelCount(): Promise<number> {
    if (this.endpoints?.levelCount) {
      try {
        const response = await fetch(`${this.baseUrl}${this.endpoints.levelCount}`, {
          headers: this.headers,
        });
        if (response.ok) {
          const data = await response.json();
          return data.levels ?? data.levelCount ?? 1;
        }
      } catch (error) {
        console.error('Failed to fetch level count:', error);
      }
    }
    
    // Fallback: try to get from metadata endpoint
    if (this.endpoints?.metadata) {
      try {
        const response = await fetch(`${this.baseUrl}${this.endpoints.metadata}`, {
          headers: this.headers,
        });
        if (response.ok) {
          const data = await response.json();
          return data.levels ?? data.levelCount ?? 1;
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    }
    
    return 1;
  }
}

