# @tessera/formats

Image format support for Tessera. Provides parsers for multiple image formats with tile source configurations and custom format support.

## Installation

```bash
pnpm add @tessera/formats
```

## Supported Formats

### Built-in Formats

#### Medical & Scientific Imaging
- **TIFF/OME-TIFF** - Tagged Image File Format and OME-TIFF (Open Microscopy Environment)
- **DICOM** - Digital Imaging and Communications in Medicine
- **NIfTI** - Neuroimaging Informatics Technology Initiative format (.nii, .nii.gz)
- **NRRD** - Nearly Raw Raster Data format
- **BIFF** - Bio-Image File Format

#### Digital Pathology
- **NDPI** - Hamamatsu NDPI (NanoZoomer Digital Pathology Image) format
- **SVS** - Aperio ScanScope Virtual Slide format
- **SCN** - Leica SCN (Scan) format

#### Array & Data Formats
- **Zarr** - Zarr array format for chunked arrays
- **HDF5** - Hierarchical Data Format version 5 (.h5, .hdf5, .hdf)

#### Web & Standard Formats
- **IIIF** - International Image Interoperability Framework Image API (v2 & v3)
- **JPEG** - Joint Photographic Experts Group image format (.jpg, .jpeg)
- **PNG** - Portable Network Graphics image format
- **WebP** - WebP image format
- **JPEG2000** - JPEG 2000 image format (.jp2, .jpx, .j2k, .j2c)
- **JPEG XL** - JPEG XL image format (.jxl)
- **HEIC/HEIF** - High Efficiency Image Container/Format (.heic, .heif, .hif)

#### Overlay & Annotation Formats
- **GeoJSON** - GeoJSON format for geographic data overlays (use with annotation system)

## Usage

### Basic Usage

```typescript
import { createTileSource } from '@tessera/formats';

// Auto-detect format from URL
const tileSource = await createTileSource('https://example.com/image.tiff');

// Specify format explicitly
const tileSource = await createTileSource('https://example.com/image.tiff', {
  format: 'tiff',
  config: {
    tileSize: 512,
    headers: {
      'Authorization': 'Bearer token',
    },
  },
});
```

### Using Format Parsers Directly

```typescript
import { TIFFParser, IIIFParser, SVSParser, JPEG2000Parser } from '@tessera/formats';

// TIFF/OME-TIFF parser
const tiffParser = new TIFFParser();
if (await tiffParser.canParse(url)) {
  const tileSource = await tiffParser.parse(url, {
    tileSize: 256,
    baseUrl: url,
  });
}

// IIIF parser
const iiifParser = new IIIFParser();
const tileSource = await iiifParser.parse('https://example.com/iiif/image/info.json', {
  version: 3,
  tileSize: 256,
});

// SVS (digital pathology) parser
const svsParser = new SVSParser();
const tileSource = await svsParser.parse('https://example.com/slide.svs', {
  tileSize: 512,
});

// JPEG2000 parser
const jp2Parser = new JPEG2000Parser();
const tileSource = await jp2Parser.parse('https://example.com/image.jp2', {
  tileSize: 256,
});
```

### Custom Formats

#### Simple Custom Format

```typescript
import { createSimpleImageFormat } from '@tessera/formats';

// Create a simple format parser for BMP images
const bmpParser = createSimpleImageFormat(
  'bmp',
  ['bmp'],
  ['image/bmp']
);

// Use it
const tileSource = await createTileSource('https://example.com/image.bmp');
```

#### Advanced Custom Format

```typescript
import { createCustomFormat, HTTPTileSource } from '@tessera/formats';

const customParser = createCustomFormat({
  id: 'myformat',
  name: 'My Custom Format',
  description: 'Custom image format',
  extensions: ['myimg'],
  mimeTypes: ['image/myformat'],
  supportsTiling: true,
  supportsPyramids: true,
  supportsMultiChannel: false,
  priority: 10, // Higher priority = checked first
  
  canParse: async (source) => {
    if (typeof source === 'string') {
      return source.endsWith('.myimg');
    }
    return false;
  },
  
  parse: async (source, config) => {
    if (typeof source !== 'string') {
      throw new Error('Only URL sources supported');
    }
    
    return new HTTPTileSource({
      baseUrl: source,
      tileSize: config?.tileSize ?? 256,
      headers: config?.headers,
      getTileUrl: (level, x, y) => {
        return `${source}/tile/${level}/${x}/${y}`;
      },
      getImageSize: async () => {
        // Fetch metadata to get dimensions
        const response = await fetch(`${source}/metadata`);
        const metadata = await response.json();
        return [metadata.width, metadata.height];
      },
      getLevelCount: async () => {
        // Calculate pyramid levels
        return 5;
      },
    });
  },
});
```

### Format Registry

```typescript
import { formatRegistry, getAvailableFormats, isFormatSupported } from '@tessera/formats';

// Get all available formats
const formats = getAvailableFormats();
console.log(formats); // ['tiff', 'zarr', 'dicom', 'iiif', ...]

// Check if format is supported
if (isFormatSupported('tiff')) {
  // Use TIFF format
}

// Access registry directly
const parser = formatRegistry.get('myformat');
if (parser) {
  const tileSource = await parser.parse(url);
}
```

## Format Configurations

Each format parser accepts a configuration object with format-specific options:

### TIFF Configuration

```typescript
interface TIFFConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
  useHTTP?: boolean;
}
```

### IIIF Configuration

```typescript
interface IIIFConfig {
  version?: 2 | 3;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

### Zarr Configuration

```typescript
interface ZarrConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
  arrayName?: string;
}
```

### DICOM Configuration

```typescript
interface DICOMConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
  seriesInstanceUID?: string;
}
```

### Digital Pathology Formats

#### SVS Configuration

```typescript
interface SVSConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

#### NDPI Configuration

```typescript
interface NDPIConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

#### SCN Configuration

```typescript
interface SCNConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

### Modern Image Formats

#### JPEG2000 Configuration

```typescript
interface JPEG2000Config {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

#### JPEG XL Configuration

```typescript
interface JPEGXLConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

#### HEIC Configuration

```typescript
interface HEICConfig {
  baseUrl?: string;
  tileSize?: number;
  headers?: Record<string, string>;
}
```

## Tile Sources

The package provides base tile source implementations:

- **HTTPTileSource** - For HTTP-based tile sources
- **MemoryTileSource** - For in-memory image data
- **BaseTileSource** - Abstract base class for custom implementations

## API Reference

### Factory Functions

- `createTileSource(source, options?)` - Create a tile source from a format source
- `getAvailableFormats()` - Get list of all available format IDs
- `isFormatSupported(formatId)` - Check if a format is supported

### Custom Format Functions

- `createCustomFormat(options)` - Create a custom format parser
- `createSimpleImageFormat(id, extensions, mimeTypes)` - Create a simple image format parser

### Registry

- `formatRegistry` - Global format registry instance
- `FormatRegistry` - Format registry class

## Format Detection

The system supports automatic format detection based on:
- File extensions
- MIME types
- Magic bytes (file signatures)
- URL patterns (for web-based formats like IIIF)

You can also explicitly specify the format:

```typescript
// Explicit format specification
const tileSource = await createTileSource(url, {
  format: 'svs', // Force SVS format
  config: { tileSize: 512 }
});
```

## Format Capabilities

Each format has different capabilities:

| Format | Tiling | Pyramids | Multi-Channel |
|--------|--------|----------|---------------|
| TIFF/OME-TIFF | ✅ | ✅ | ✅ |
| Zarr | ✅ | ✅ | ✅ |
| DICOM | ✅ | ❌ | ❌ |
| IIIF | ✅ | ✅ | ❌ |
| JPEG | ❌ | ❌ | ❌ |
| PNG | ❌ | ❌ | ✅ |
| WebP | ❌ | ❌ | ✅ |
| JPEG2000 | ✅ | ✅ | ✅ |
| JPEG XL | ❌ | ❌ | ✅ |
| HEIC | ❌ | ❌ | ✅ |
| NDPI | ✅ | ✅ | ✅ |
| SVS | ✅ | ✅ | ✅ |
| SCN | ✅ | ✅ | ✅ |
| NIfTI | ✅ | ❌ | ❌ |
| NRRD | ✅ | ❌ | ✅ |
| HDF5 | ✅ | ✅ | ✅ |
| BIFF | ✅ | ✅ | ✅ |

## Examples

### Digital Pathology Workflow

```typescript
import { createTileSource, SVSParser } from '@tessera/formats';

// Load a digital pathology slide
const slideSource = await createTileSource('https://pathology-server.com/slide.svs', {
  config: {
    tileSize: 512,
    headers: {
      'Authorization': 'Bearer token',
    },
  },
});
```

### Medical Imaging

```typescript
import { createTileSource, DICOMParser } from '@tessera/formats';

// Load DICOM series
const dicomSource = await createTileSource('https://pacs-server.com/series/123', {
  format: 'dicom',
  config: {
    seriesInstanceUID: '1.2.840.113619.2.55.3...',
    tileSize: 256,
  },
});
```

### Modern Image Formats

```typescript
import { createTileSource } from '@tessera/formats';

// JPEG XL
const jxlSource = await createTileSource('https://example.com/image.jxl');

// HEIC
const heicSource = await createTileSource('https://example.com/image.heic');

// JPEG2000
const jp2Source = await createTileSource('https://example.com/image.jp2', {
  config: { tileSize: 512 }
});
```

## API Protocol Tile Sources

The package also supports creating tile sources from various API protocols, allowing you to integrate with your own backend services.

### Supported API Protocols

- **REST** - Standard REST API endpoints
- **GraphQL** - GraphQL API with queries
- **tRPC** - Type-safe RPC calls
- **gRPC** - gRPC-Web or gRPC-HTTP/JSON transcoding
- **SOAP/XML** - SOAP web services
- **AJAX** - AJAX requests (uses REST)
- **Custom** - Custom protocols with URL generators

### Quick Example

```typescript
import { RESTTileSource, URLTemplates, createAPITileSource } from '@tessera/formats';

// Using REST API with URL template
const tileSource = await createAPITileSource({
  baseUrl: 'https://your-backend.com',
  protocol: 'rest',
  tileSize: 256,
  urlTemplate: '{baseUrl}/api/tiles/{level}/{x}/{y}',
  auth: {
    type: 'bearer',
    token: 'your-token',
  },
});

// Custom URL generator
const customSource = await createAPITileSource({
  baseUrl: 'https://your-backend.com',
  protocol: 'rest',
  urlGenerator: (params) => {
    const { level, x, y, baseUrl } = params;
    return `${baseUrl}/custom/path/${level}/${x}/${y}?format=png`;
  },
});
```

For detailed API protocol documentation, see [API Protocol Tile Sources](./src/api/README.md).

See the [Tessera documentation](../../docs/) for more examples and usage patterns.
