/**
 * API protocol parser for creating tile sources from various API protocols
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import type { APITileSourceConfig, APIProtocol } from './types.js';
import { RESTTileSource } from './rest-source.js';
import { GraphQLTileSource } from './graphql-source.js';
import { TRPCTileSource } from './trpc-source.js';
import { SOAPTileSource } from './soap-source.js';
import { GRPCTileSource } from './grpc-source.js';

/**
 * API parser configuration
 */
export interface APIParserConfig extends FormatConfig {
  /** API protocol */
  protocol: APIProtocol;
  /** Base URL for the API */
  baseUrl: string;
  /** URL template or generator function */
  urlTemplate?: string | import('./types.js').URLTemplate;
  /** Custom URL generator function (overrides urlTemplate) */
  urlGenerator?: import('./types.js').URLTemplate;
  /** Tile size */
  tileSize?: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** API-specific configuration */
  apiConfig?: Partial<APITileSourceConfig>;
}

/**
 * API protocol parser
 */
export class APIParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'api',
    name: 'API Protocol',
    description: 'Tile source from various API protocols (REST, GraphQL, tRPC, gRPC, SOAP)',
    mimeTypes: ['application/json', 'application/xml', 'text/xml'],
    extensions: [],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    // API parsers work with URLs/endpoints, not file detection
    if (typeof source === 'string') {
      // Check if it looks like an API endpoint
      return (
        source.startsWith('http://') ||
        source.startsWith('https://') ||
        source.startsWith('/api/') ||
        source.includes('/graphql') ||
        source.includes('/trpc') ||
        source.includes('/grpc') ||
        source.includes('/soap')
      );
    }
    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: APIParserConfig
  ): Promise<TileSource> {
    if (typeof source !== 'string') {
      throw new Error('API parser only supports URL sources');
    }

    if (!config?.protocol) {
      throw new Error('API protocol must be specified');
    }

    const baseConfig: APITileSourceConfig = {
      baseUrl: config.baseUrl ?? source,
      protocol: config.protocol,
      urlTemplate: config.urlTemplate,
      urlGenerator: config.urlGenerator,
      tileSize: config.tileSize,
      headers: config.headers,
      ...config.apiConfig,
    };

    switch (config.protocol) {
      case 'rest':
        return new RESTTileSource(baseConfig);
      
      case 'graphql':
        return new GraphQLTileSource({
          ...baseConfig,
          ...config.apiConfig,
        });
      
      case 'trpc':
        return new TRPCTileSource({
          ...baseConfig,
          ...config.apiConfig,
        });
      
      case 'grpc':
        return new GRPCTileSource({
          ...baseConfig,
          ...config.apiConfig,
        });
      
      case 'soap':
      case 'xml':
        return new SOAPTileSource({
          ...baseConfig,
          ...config.apiConfig,
        });
      
      case 'ajax':
        // AJAX is essentially REST
        return new RESTTileSource(baseConfig);
      
      case 'rpc':
        // Generic RPC - use REST as fallback
        return new RESTTileSource(baseConfig);
      
      case 'custom':
        // For custom protocols, require a custom URL generator
        if (!config.urlGenerator) {
          throw new Error('Custom protocol requires a urlGenerator function');
        }
        return new RESTTileSource({
          ...baseConfig,
          urlGenerator: config.urlGenerator,
        });
      
      default:
        throw new Error(`Unsupported API protocol: ${config.protocol}`);
    }
  }
}

/**
 * Create an API tile source directly (async)
 */
export async function createAPITileSource(config: APITileSourceConfig): Promise<TileSource> {
  const parser = new APIParser();
  return parser.parse(config.baseUrl, {
    protocol: config.protocol ?? 'rest',
    baseUrl: config.baseUrl,
    urlTemplate: config.urlTemplate,
    urlGenerator: config.urlGenerator,
    tileSize: config.tileSize,
    headers: config.headers,
    apiConfig: config,
  });
}

