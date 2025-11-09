# API Protocol Tile Sources

Support for creating tile sources from various API protocols including REST, GraphQL, tRPC, gRPC, SOAP, and custom APIs.

## Features

- **Multiple Protocol Support**: REST, GraphQL, tRPC, gRPC, SOAP/XML, AJAX
- **URL Templates**: Flexible URL template system with placeholders
- **Custom URL Generators**: Override URL generation with custom functions
- **Authentication**: Bearer tokens, Basic auth, API keys, and custom auth
- **Flexible Configuration**: Support for various API endpoint patterns

## Usage

### REST API

```typescript
import { RESTTileSource, URLTemplates } from '@tessera/formats';

const tileSource = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  protocol: 'rest',
  tileSize: 256,
  urlTemplate: URLTemplates.standard, // or custom template string
  headers: {
    'Authorization': 'Bearer token',
  },
  endpoints: {
    metadata: '/api/metadata',
    imageSize: '/api/image/size',
    levelCount: '/api/image/levels',
  },
});
```

### GraphQL API

```typescript
import { GraphQLTileSource } from '@tessera/formats';

const tileSource = new GraphQLTileSource({
  baseUrl: 'https://api.example.com/graphql',
  protocol: 'graphql',
  tileSize: 256,
  tileQuery: `
    query GetTile($level: Int!, $x: Int!, $y: Int!) {
      tile(level: $level, x: $x, y: $y) {
        url
        width
        height
      }
    }
  `,
  metadataQuery: `
    query GetMetadata {
      metadata {
        width
        height
        levels
      }
    }
  `,
  auth: {
    type: 'bearer',
    token: 'your-token',
  },
});
```

### tRPC API

```typescript
import { TRPCTileSource } from '@tessera/formats';

const tileSource = new TRPCTileSource({
  baseUrl: 'https://api.example.com',
  protocol: 'trpc',
  tileSize: 256,
  batchEndpoint: '/api/trpc',
  tileProcedure: 'tile.get',
  metadataProcedure: 'metadata.get',
  auth: {
    type: 'bearer',
    token: 'your-token',
  },
});
```

### gRPC API

```typescript
import { GRPCTileSource } from '@tessera/formats';

const tileSource = new GRPCTileSource({
  baseUrl: 'https://api.example.com',
  protocol: 'grpc',
  tileSize: 256,
  service: 'TileService',
  tileMethod: 'GetTile',
  metadataMethod: 'GetMetadata',
  useGRPCWeb: false, // Use gRPC-HTTP/JSON transcoding
  auth: {
    type: 'api-key',
    apiKey: 'your-api-key',
    apiKeyHeader: 'X-API-Key',
  },
});
```

### SOAP/XML API

```typescript
import { SOAPTileSource } from '@tessera/formats';

const tileSource = new SOAPTileSource({
  baseUrl: 'https://api.example.com/soap',
  protocol: 'soap',
  tileSize: 256,
  tileAction: 'GetTile',
  metadataAction: 'GetMetadata',
  envelopeTemplate: `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <{action} xmlns="http://example.com/tiles">
          <level>{level}</level>
          <x>{x}</x>
          <y>{y}</y>
        </{action}>
      </soap:Body>
    </soap:Envelope>
  `,
});
```

## URL Templates

### Built-in Templates

```typescript
import { URLTemplates, createURLTemplate } from '@tessera/formats';

// Standard pattern: /tiles/{level}/{x}/{y}
const source1 = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlTemplate: URLTemplates.standard,
});

// Z/X/Y pattern: /{level}/{x}/{y}
const source2 = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlTemplate: URLTemplates.zxy,
});

// Query parameter pattern: /tile?level={level}&x={x}&y={y}
const source3 = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlTemplate: URLTemplates.query,
});

// TMS pattern: /{level}/{x}/{y}.png
const source4 = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlTemplate: URLTemplates.tms,
});
```

### Custom URL Template String

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlTemplate: '{baseUrl}/api/v1/images/{imageId}/tiles/{level}/{x}/{y}',
  // Additional parameters can be passed
});
```

### Custom URL Generator Function

```typescript
import type { URLTemplate } from '@tessera/formats';

const customGenerator: URLTemplate = (params) => {
  // Custom logic for URL generation
  const { level, x, y, baseUrl, tileSize } = params;
  
  // Example: Use different endpoints based on level
  if (level === 0) {
    return `${baseUrl}/high-res/${x}/${y}`;
  } else {
    return `${baseUrl}/tiles/${level}/${x}/${y}`;
  }
};

const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlGenerator: customGenerator,
});
```

## Authentication

### Bearer Token

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'bearer',
    token: 'your-bearer-token',
  },
});
```

### Basic Authentication

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'basic',
    username: 'user',
    password: 'pass',
  },
});
```

### API Key

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'api-key',
    apiKey: 'your-api-key',
    apiKeyHeader: 'X-API-Key', // Optional, defaults to 'X-API-Key'
  },
});
```

### Custom Authentication

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  auth: {
    type: 'custom',
    customAuth: (config) => {
      // Custom authentication logic
      return {
        ...config,
        headers: {
          ...config.headers,
          'X-Custom-Auth': 'custom-value',
        },
      };
    },
  },
});
```

## Using with Format Factory

```typescript
import { createAPITileSource } from '@tessera/formats';

const tileSource = await createAPITileSource({
  baseUrl: 'https://api.example.com',
  protocol: 'rest',
  tileSize: 256,
  urlTemplate: '{baseUrl}/tiles/{level}/{x}/{y}',
  auth: {
    type: 'bearer',
    token: 'your-token',
  },
});
```

## Advanced Configuration

### Custom Request Configuration

```typescript
const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  requestConfig: {
    method: 'POST',
    headers: {
      'Custom-Header': 'value',
    },
    body: {
      format: 'png',
      quality: 'high',
    },
    timeout: 5000,
  },
});
```

### Custom Response Handler

```typescript
import type { APIResponseHandler } from '@tessera/formats';

const customHandler: APIResponseHandler = async (response) => {
  // Custom response processing
  const data = await response.json();
  return {
    url: data.tileUrl,
    width: data.dimensions.width,
    height: data.dimensions.height,
  };
};

const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  responseHandler: customHandler,
});
```

## Examples

### Backend Integration

```typescript
// Your backend serves tiles at: /api/tiles/{level}/{x}/{y}
const tileSource = new RESTTileSource({
  baseUrl: 'https://your-backend.com',
  urlTemplate: '{baseUrl}/api/tiles/{level}/{x}/{y}',
  tileSize: 512,
  auth: {
    type: 'bearer',
    token: await getAuthToken(),
  },
  endpoints: {
    metadata: '/api/metadata',
  },
});
```

### Override URL Generator

```typescript
// Custom logic: different CDN for different regions
const urlGenerator: URLTemplate = (params) => {
  const { level, x, y, baseUrl } = params;
  const region = getRegionForTile(x, y);
  const cdnUrl = getCDNUrl(region);
  return `${cdnUrl}/tiles/${level}/${x}/${y}`;
};

const source = new RESTTileSource({
  baseUrl: 'https://api.example.com',
  urlGenerator: urlGenerator,
});
```

### GraphQL with Variables

```typescript
const source = new GraphQLTileSource({
  baseUrl: 'https://api.example.com/graphql',
  tileQuery: `
    query GetTile($level: Int!, $x: Int!, $y: Int!, $imageId: String!) {
      tile(level: $level, x: $x, y: $y, imageId: $imageId) {
        url
      }
    }
  `,
  variables: {
    imageId: 'image-123',
  },
});
```

