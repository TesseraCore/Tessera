# Tech Stack

## Core Technologies

### Rendering Backends (Priority Order)
1. **WebGPU** (Primary)
   - Modern GPU API, best performance
   - Compute shaders for advanced operations
   - Requires Chrome 113+, Edge 113+, Safari 16.4+

2. **WebGL2** (Fallback #1)
   - Widely supported, good performance
   - Texture arrays, uniform buffers
   - Requires modern browsers

3. **WebGL** (Fallback #2)
   - Maximum compatibility
   - Limited features, slower performance
   - Legacy browser support

4. **Canvas2D** (Fallback #3)
   - Universal fallback
   - No GPU acceleration
   - Used for simple cases or when GPU unavailable

### Language & Framework
- **TypeScript** (Primary language)
  - Type safety for complex geometry/annotation code
  - Better IDE support and refactoring
  - Compile to ES2020+ for modern browsers

- **No UI Framework** (Vanilla JS/TS)
  - Framework-agnostic core library
  - Apps can use React, Vue, Angular, or vanilla JS
  - Small API surface, easy to integrate

### Build Tools
- **Vite** or **esbuild** (Fast bundling)
- **TypeScript Compiler** (tsc)
- **Rollup** (For library builds)

### Testing
- **Jest** or **Vitest** (Unit tests)
- **Playwright** or **Puppeteer** (E2E tests)
- **Golden tests** (Visual regression for rendering)

## Dependencies

### Core Libraries
- **HarfBuzz (WASM)**: Text shaping for complex scripts
- **Spatial Index**: R-tree implementation (custom or rbush)
- **Boolean Operations**: Polygon clipping (clipper-lib or custom WASM)
- **Color Science**: Color space conversions (colorjs.io or custom)

### Image Format Support
- **TIFF.js** or **UTIF.js**: TIFF/OME-TIFF parsing
- **Zarr.js**: Zarr array format support
- **DICOM Parsers**: dcmjs or custom DICOM reader
- **IIIF**: Native IIIF Image API support
- **JPEG/PNG**: Native browser support

### Math & Geometry
- **gl-matrix** or custom: Matrix/vector math
- **Custom geometry library**: 2D geometry operations
- **Douglas-Peucker**: Path simplification
- **Chaikin smoothing**: Curve smoothing

### Calibration & Analysis
- **FFT (WASM)**: Fast Fourier Transform for grid detection
- **RANSAC**: Outlier rejection for calibration
- **Image processing**: Sobel, Hough transforms (custom or WASM)

### Font Rendering
- **MSDF/SDF**: Multi-channel signed distance fields for crisp text
- **Font parsing**: opentype.js or custom parser
- **Emoji fonts**: Noto Color Emoji or system fallback

## Development Tools

### Code Quality
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript strict mode**: Maximum type safety

### Documentation
- **TypeDoc**: API documentation generation
- **Markdown**: Project documentation

### Performance
- **Chrome DevTools**: Performance profiling
- **WebGPU Inspector**: GPU debugging
- **Memory profiler**: Track memory usage

## Browser Support

### Minimum Requirements
- **Chrome/Edge**: 113+ (WebGPU)
- **Firefox**: 110+ (WebGPU)
- **Safari**: 16.4+ (WebGPU)
- **Fallback**: Any browser with WebGL (older versions)

### Feature Detection
- Progressive enhancement: Detect WebGPU → WebGL2 → WebGL → Canvas2D
- Graceful degradation: Disable features when unavailable
- Polyfills: None (use native APIs only)

## Platform Support
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS Safari, Android Chrome
- **Tablets**: iPadOS, Android tablets
- **Touch**: Full touch/stylus support

## Architecture Decisions

### Why TypeScript?
- Complex geometry code benefits from types
- Plugin system needs strong interfaces
- Medical/measurement code requires precision

### Why No UI Framework?
- Framework-agnostic library
- Smaller bundle size
- Easier to integrate into existing apps
- UI is application concern, not library concern

### Why Multiple Backends?
- Maximum compatibility
- Performance optimization per platform
- Future-proofing (WebGPU is the future)

### Why WASM for Some Operations?
- Heavy computation (FFT, RANSAC, boolean ops)
- Deterministic results (important for medical)
- Performance (faster than JS for math-heavy code)

