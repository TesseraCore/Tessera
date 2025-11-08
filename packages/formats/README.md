# @tessera/formats

Image format support for Tessera. Provides parsers for multiple image formats with tile source configurations and custom format support.

## Installation

```bash
pnpm add @tessera/formats
```

## Supported Formats

### Built-in Formats

- **TIFF/OME-TIFF** - Tagged Image File Format and OME-TIFF
- **Zarr** - Zarr array format for chunked arrays
- **DICOM** - Digital Imaging and Communications in Medicine
- **IIIF** - International Image Interoperability Framework Image API
- **JPEG** - Joint Photographic Experts Group image format
- **PNG** - Portable Network Graphics image format
- **WebP** - WebP image format
- **NIfTI** - Neuroimaging Informatics Technology Initiative format
- **NRRD** - Nearly Raw Raster Data format
- **HDF5** - Hierarchical Data Format version 5

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
import { TIFFParser, IIIFParser } from '@tessera/formats';

// TIFF parser
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

## Examples

See the [Tessera documentation](../../docs/) for more examples and usage patterns.
