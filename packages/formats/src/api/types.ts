/**
 * API protocol types and interfaces
 */

/**
 * URL template function for generating tile URLs
 */
export type URLTemplate = (params: {
  level: number;
  x: number;
  y: number;
  tileSize: number;
  baseUrl: string;
  [key: string]: any;
}) => string;

/**
 * API protocol type
 */
export type APIProtocol = 
  | 'rest'
  | 'graphql'
  | 'trpc'
  | 'grpc'
  | 'rpc'
  | 'soap'
  | 'xml'
  | 'ajax'
  | 'custom';

/**
 * API request configuration
 */
export interface APIRequestConfig {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: any;
  /** Query parameters */
  params?: Record<string, any>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * API response handler
 */
export type APIResponseHandler<T = any> = (
  response: Response
) => Promise<T>;

/**
 * API tile source configuration
 */
export interface APITileSourceConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API protocol */
  protocol?: APIProtocol;
  /** URL template or generator function */
  urlTemplate?: string | URLTemplate;
  /** Custom URL generator function (overrides urlTemplate) */
  urlGenerator?: URLTemplate;
  /** Tile size */
  tileSize?: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** API endpoint paths */
  endpoints?: {
    /** Endpoint for getting tile metadata */
    metadata?: string;
    /** Endpoint for getting tile */
    tile?: string;
    /** Endpoint for getting image size */
    imageSize?: string;
    /** Endpoint for getting level count */
    levelCount?: string;
  };
  /** Custom request configuration */
  requestConfig?: APIRequestConfig;
  /** Custom response handler */
  responseHandler?: APIResponseHandler;
  /** Authentication configuration */
  auth?: {
    type: 'bearer' | 'basic' | 'api-key' | 'custom';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    customAuth?: (config: APIRequestConfig) => APIRequestConfig;
  };
}

