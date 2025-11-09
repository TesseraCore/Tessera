/**
 * SOAP/XML API tile source
 */

import type { Tile } from '@tessera/rendering';
import { BaseTileSource } from '../sources/base-source.js';
import type { APITileSourceConfig, URLTemplate } from './types.js';
import { parseURLTemplate, URLTemplates } from './url-templates.js';

/**
 * SOAP tile source configuration
 */
export interface SOAPTileSourceConfig extends APITileSourceConfig {
  /** SOAP action for getting tile */
  tileAction?: string;
  /** SOAP action for getting metadata */
  metadataAction?: string;
  /** SOAP envelope template */
  envelopeTemplate?: string;
}

/**
 * SOAP/XML API tile source
 */
export class SOAPTileSource extends BaseTileSource {
  private baseUrl: string;
  private urlGenerator: URLTemplate;
  private headers: Record<string, string>;
  private tileAction: string;
  private metadataAction: string;
  private envelopeTemplate: string;

  constructor(config: SOAPTileSourceConfig) {
    super(config.tileSize);
    this.baseUrl = config.baseUrl;
    this.headers = this.buildHeaders(config);
    this.tileAction = config.tileAction ?? 'GetTile';
    this.metadataAction = config.metadataAction ?? 'GetMetadata';
    this.envelopeTemplate = config.envelopeTemplate ?? `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <{action} xmlns="http://example.com/tiles">
            <level>{level}</level>
            <x>{x}</x>
            <y>{y}</y>
          </{action}>
        </soap:Body>
      </soap:Envelope>
    `;
    
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
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `"${this.tileAction}"`,
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

  private buildSOAPEnvelope(action: string, params: Record<string, any>): string {
    let envelope = this.envelopeTemplate;
    envelope = envelope.replace(/{action}/g, action);
    
    for (const [key, value] of Object.entries(params)) {
      envelope = envelope.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    
    return envelope;
  }

  private async callSOAP(action: string, params: Record<string, any>): Promise<any> {
    const envelope = this.buildSOAPEnvelope(action, params);
    const headers = {
      ...this.headers,
      'SOAPAction': `"${action}"`,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: envelope,
    });

    if (!response.ok) {
      throw new Error(`SOAP call failed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    // Simple XML parsing - in production, use a proper XML parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Extract result (simplified - adjust based on your SOAP response structure)
    const result = xmlDoc.querySelector('result')?.textContent;
    if (result) {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    
    return null;
  }

  async getTile(level: number, x: number, y: number): Promise<Tile | null> {
    try {
      // Try SOAP call first
      const result = await this.callSOAP(this.tileAction, { level, x, y });
      
      if (result?.url) {
        // Fetch tile from URL returned by SOAP
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
      console.error(`Failed to load tile via SOAP ${level}/${x}/${y}:`, error);
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
      const result = await this.callSOAP(this.metadataAction, {});
      if (result) {
        return [result.width ?? 0, result.height ?? 0];
      }
    } catch (error) {
      console.error('Failed to fetch metadata via SOAP:', error);
    }
    
    return [0, 0];
  }

  async getLevelCount(): Promise<number> {
    try {
      const result = await this.callSOAP(this.metadataAction, {});
      if (result) {
        return result.levels ?? result.levelCount ?? 1;
      }
    } catch (error) {
      console.error('Failed to fetch metadata via SOAP:', error);
    }
    
    return 1;
  }
}

