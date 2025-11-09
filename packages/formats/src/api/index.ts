/**
 * API protocol tile sources
 */

// Types
export type {
  APIProtocol,
  APITileSourceConfig,
  APIRequestConfig,
  APIResponseHandler,
  URLTemplate,
} from './types.js';

// URL Templates
export {
  parseURLTemplate,
  createURLTemplate,
  URLTemplates,
} from './url-templates.js';

// Tile Sources
export { RESTTileSource } from './rest-source.js';
export { GraphQLTileSource } from './graphql-source.js';
export type { GraphQLTileSourceConfig } from './graphql-source.js';
export { TRPCTileSource } from './trpc-source.js';
export type { TRPCTileSourceConfig } from './trpc-source.js';
export { SOAPTileSource } from './soap-source.js';
export type { SOAPTileSourceConfig } from './soap-source.js';
export { GRPCTileSource } from './grpc-source.js';
export type { GRPCTileSourceConfig } from './grpc-source.js';

// Parser
export { APIParser, createAPITileSource } from './parser.js';
export type { APIParserConfig } from './parser.js';

