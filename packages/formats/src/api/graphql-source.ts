/**
 * GraphQL API tile source
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from '../sources/base-source.js';
import type { APITileSourceConfig, URLTemplate } from './types.js';
import { parseURLTemplate, URLTemplates } from './url-templates.js';

/**
 * GraphQL tile source configuration
 */
export interface GraphQLTileSourceConfig extends APITileSourceConfig {
  /** GraphQL query for fetching tile */
  tileQuery?: string;
  /** GraphQL query for fetching metadata */
  metadataQuery?: string;
  /** GraphQL variables */
  variables?: Record<string, any>;
}

/**
 * GraphQL API tile source
 */
export class GraphQLTileSource extends BaseTileSource {
  private baseUrl: string;
  private urlGenerator: URLTemplate;
  private headers: Record<string, string>;
  private tileQuery: string;
  private metadataQuery: string;
  private variables: Record<string, any>;

  constructor(config: GraphQLTileSourceConfig) {
    super(config.tileSize);
    this.baseUrl = config.baseUrl;
    this.headers = this.buildHeaders(config);
    this.tileQuery = config.tileQuery ?? `
      query GetTile($level: Int!, $x: Int!, $y: Int!) {
        tile(level: $level, x: $x, y: $y) {
          url
          width
          height
        }
      }
    `;
    this.metadataQuery = config.metadataQuery ?? `
      query GetMetadata {
        metadata {
          width
          height
          levels
        }
      }
    `;
    this.variables = config.variables ?? {};
    
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
      // Default: use GraphQL endpoint, but fallback to standard template
      this.urlGenerator = URLTemplates.standard;
    }
  }

  private buildHeaders(config: APITileSourceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
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

  private async executeQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query,
        variables: { ...this.variables, ...variables },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    try {
      // Try GraphQL query first
      const data = await this.executeQuery(this.tileQuery, { level, x, y });
      const tileData = data.tile;
      
      if (tileData?.url) {
        // Fetch tile from URL returned by GraphQL
        const tileResponse = await fetch(tileData.url, {
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
      console.error(`Failed to load tile via GraphQL ${level}/${x}/${y}:`, error);
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
      const data = await this.executeQuery(this.metadataQuery);
      const metadata = data.metadata;
      if (metadata) {
        return [metadata.width ?? 0, metadata.height ?? 0];
      }
    } catch (error) {
      console.error('Failed to fetch metadata via GraphQL:', error);
    }
    
    return [0, 0];
  }

  async getLevelCount(): Promise<number> {
    try {
      const data = await this.executeQuery(this.metadataQuery);
      const metadata = data.metadata;
      if (metadata) {
        return metadata.levels ?? metadata.levelCount ?? 1;
      }
    } catch (error) {
      console.error('Failed to fetch metadata via GraphQL:', error);
    }
    
    return 1;
  }
}

