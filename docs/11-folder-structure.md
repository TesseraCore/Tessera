# Folder Structure

## Proposed Project Structure

```
tessera/
├── packages/                    # Monorepo packages
│   ├── core/                    # Core viewer library
│   │   ├── src/
│   │   │   ├── viewer.ts        # Main viewer class
│   │   │   ├── viewport.ts      # Viewport management
│   │   │   ├── state.ts         # State management
│   │   │   └── index.ts         # Public API
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── rendering/               # Rendering engine
│   │   ├── src/
│   │   │   ├── backend/         # Backend implementations
│   │   │   │   ├── webgpu.ts
│   │   │   │   ├── webgl2.ts
│   │   │   │   ├── webgl.ts
│   │   │   │   └── canvas2d.ts
│   │   │   ├── tiles/           # Tile management
│   │   │   │   ├── manager.ts
│   │   │   │   ├── cache.ts
│   │   │   │   └── source.ts
│   │   │   ├── color/           # Color pipeline
│   │   │   │   ├── pipeline.ts
│   │   │   │   ├── lut.ts
│   │   │   │   └── profile.ts
│   │   │   ├── shaders/         # GPU shaders
│   │   │   │   ├── tile.wgsl
│   │   │   │   ├── annotation.wgsl
│   │   │   │   └── color.wgsl
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── annotations/             # Annotation system
│   │   ├── src/
│   │   │   ├── store/           # Annotation storage
│   │   │   │   ├── store.ts
│   │   │   │   └── transaction.ts
│   │   │   ├── spatial/         # Spatial indexing
│   │   │   │   ├── rtree.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/           # Built-in types
│   │   │   │   ├── point.ts
│   │   │   │   ├── line.ts
│   │   │   │   ├── polygon.ts
│   │   │   │   ├── rectangle.ts
│   │   │   │   ├── ellipse.ts
│   │   │   │   └── text.ts
│   │   │   ├── plugins/         # Plugin system
│   │   │   │   ├── registry.ts
│   │   │   │   └── types.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── tools/                    # Drawing/editing tools
│   │   ├── src/
│   │   │   ├── drawing/         # Drawing tools
│   │   │   │   ├── rectangle.ts
│   │   │   │   ├── ellipse.ts
│   │   │   │   ├── polygon.ts
│   │   │   │   ├── freehand.ts
│   │   │   │   └── text.ts
│   │   │   ├── editing/         # Editing tools
│   │   │   │   ├── vertex.ts
│   │   │   │   ├── edge.ts
│   │   │   │   ├── transform.ts
│   │   │   │   └── boolean.ts
│   │   │   ├── selection/       # Selection tools
│   │   │   │   └── select.ts
│   │   │   ├── state/           # Tool state machines
│   │   │   │   └── machine.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── geometry/                 # Geometry operations
│   │   ├── src/
│   │   │   ├── primitives/      # Basic shapes
│   │   │   │   ├── point.ts
│   │   │   │   ├── line.ts
│   │   │   │   ├── polygon.ts
│   │   │   │   └── ellipse.ts
│   │   │   ├── transforms/      # Transformations
│   │   │   │   ├── matrix.ts
│   │   │   │   ├── rotate.ts
│   │   │   │   ├── scale.ts
│   │   │   │   └── translate.ts
│   │   │   ├── boolean/         # Boolean operations
│   │   │   │   ├── union.ts
│   │   │   │   ├── intersect.ts
│   │   │   │   ├── difference.ts
│   │   │   │   └── xor.ts
│   │   │   ├── simplify/        # Path simplification
│   │   │   │   └── douglas-peucker.ts
│   │   │   ├── smooth/          # Curve smoothing
│   │   │   │   └── chaikin.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── units/                    # Units & calibration
│   │   ├── src/
│   │   │   ├── registry/         # Unit registry
│   │   │   │   ├── registry.ts
│   │   │   │   └── units.ts
│   │   │   ├── calibration/     # Calibration tools
│   │   │   │   ├── spatial.ts
│   │   │   │   ├── grayscale.ts
│   │   │   │   └── color.ts
│   │   │   ├── measurement/     # Measurement context
│   │   │   │   └── context.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── text/                     # Text rendering
│   │   ├── src/
│   │   │   ├── shaping/         # Text shaping
│   │   │   │   ├── harfbuzz.ts
│   │   │   │   └── wasm/         # HarfBuzz WASM
│   │   │   ├── atlas/           # Glyph atlas
│   │   │   │   ├── atlas.ts
│   │   │   │   ├── msdf.ts
│   │   │   │   └── emoji.ts
│   │   │   ├── layout/          # Text layout
│   │   │   │   ├── layout.ts
│   │   │   │   └── wrap.ts
│   │   │   ├── editing/        # Text editing
│   │   │   │   ├── caret.ts
│   │   │   │   └── selection.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── formats/                  # Format support
│   │   ├── src/
│   │   │   ├── tiff/            # TIFF/OME-TIFF
│   │   │   │   └── parser.ts
│   │   │   ├── zarr/            # Zarr arrays
│   │   │   │   └── parser.ts
│   │   │   ├── dicom/           # DICOM
│   │   │   │   └── parser.ts
│   │   │   ├── iiif/            # IIIF Image API
│   │   │   │   └── parser.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── import/                   # Import plugins
│   │   ├── src/
│   │   │   ├── geojson.ts
│   │   │   ├── wkt.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── export/                   # Export plugins
│   │   ├── src/
│   │   │   ├── geojson.ts
│   │   │   ├── wkt.ts
│   │   │   ├── svg.ts
│   │   │   ├── pdf.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── graph/                    # Overlay graph
│   │   ├── src/
│   │   │   ├── nodes/           # Graph nodes
│   │   │   ├── resolvers/       # Policy resolvers
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── events/                   # Event system
│   │   ├── src/
│   │   │   ├── emitter.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── utils/                    # Shared utilities
│   │   ├── src/
│   │   │   ├── math.ts
│   │   │   ├── color.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── workers/                  # Web Workers
│       ├── src/
│       │   ├── fft.ts           # FFT worker
│       │   ├── ransac.ts        # RANSAC worker
│       │   ├── boolean.ts       # Boolean ops worker
│       │   └── index.ts
│       └── package.json
│
├── apps/                         # Example applications
│   ├── demo/                     # Demo app
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   └── package.json
│   │
│   └── medical/                  # Medical imaging example
│       ├── src/
│       └── package.json
│
├── docs/                         # Documentation
│   ├── 00-project-overview.md
│   ├── 01-core-features.md
│   ├── 02-tech-stack.md
│   ├── 03-architecture.md
│   ├── 04-modules.md
│   ├── 05-components.md
│   ├── 06-annotation-system.md
│   ├── 07-drawing-tools.md
│   ├── 08-color-management.md
│   ├── 09-units-system.md
│   ├── 10-plugin-system.md
│   ├── 11-folder-structure.md
│   └── 12-implementation-guide.md
│
├── tools/                         # Build tools
│   ├── build/                    # Build scripts
│   └── scripts/                 # Utility scripts
│
├── .github/                      # GitHub workflows
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── package.json                  # Root package.json
├── pnpm-workspace.yaml          # pnpm workspace config
├── tsconfig.json                 # Root TypeScript config
├── .eslintrc.js                  # ESLint config
├── .prettierrc                   # Prettier config
├── README.md
└── LICENSE
```

## Package Structure Template

Each package follows this structure:

```
package-name/
├── src/
│   ├── index.ts                 # Public API exports
│   └── ...                      # Source files
├── tests/
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

## Key Directories

### `packages/`
Monorepo packages (core library modules)

### `apps/`
Example applications demonstrating usage

### `docs/`
Project documentation (this folder)

### `tools/`
Build tools and scripts

## File Naming Conventions

### TypeScript Files
- `camelCase.ts` for regular files
- `PascalCase.ts` for classes/components
- `kebab-case.ts` for utilities

### Test Files
- `*.test.ts` for unit tests
- `*.spec.ts` for integration tests
- Co-located with source or in `tests/` directory

### Configuration Files
- `kebab-case` (e.g., `tsconfig.json`, `.eslintrc.js`)

## Module Organization

### Core Modules (Independent)
- `@tessera/core`
- `@tessera/rendering`
- `@tessera/geometry`
- `@tessera/events`
- `@tessera/utils`

### Feature Modules (Depend on Core)
- `@tessera/annotations` → depends on core, rendering, geometry
- `@tessera/tools` → depends on annotations, events
- `@tessera/units` → depends on geometry
- `@tessera/text` → depends on rendering, annotations
- `@tessera/graph` → depends on annotations, geometry

### Format Modules (Optional)
- `@tessera/formats` → depends on rendering
- `@tessera/import` → depends on annotations
- `@tessera/export` → depends on annotations, rendering

### Worker Modules (Optional)
- `@tessera/workers` → depends on geometry

## Build Output

### Distribution Files
```
packages/core/dist/
├── index.js                    # ESM bundle
├── index.cjs                   # CommonJS bundle
├── index.d.ts                  # TypeScript definitions
└── index.d.ts.map
```

### Source Maps
- `.map` files for debugging
- Inline source maps for development

## Documentation Structure

### API Documentation
- Generated from TypeScript comments
- Output to `docs/api/`
- Using TypeDoc

### Guides
- In `docs/` directory
- Markdown format
- Numbered for ordering

## Test Structure

### Unit Tests
- Co-located with source or in `tests/unit/`
- Test individual functions/classes

### Integration Tests
- In `tests/integration/`
- Test module interactions

### E2E Tests
- In `tests/e2e/`
- Test full workflows
- Use Playwright/Puppeteer

## Example Application Structure

```
apps/demo/
├── src/
│   ├── components/             # React/Vue components
│   │   ├── Viewer.tsx
│   │   ├── Toolbar.tsx
│   │   └── PropertiesPanel.tsx
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── styles.css
├── public/                     # Static assets
├── index.html
├── vite.config.ts             # Vite config
└── package.json
```

