/**
 * tessera - Deep zoom image renderer
 * 
 * This is the main entry point for Tessera. All functionality is re-exported
 * from this package using explicit named exports for optimal tree-shaking.
 * 
 * Internal packages are private and should not be imported directly by end users.
 * Import everything from 'tessera' instead.
 * 
 * Example:
 * ```typescript
 * import { Viewer, RectangleTool, TIFFParser } from 'tessera';
 * ```
 */

// Core viewer functionality
export { Viewer } from './viewer.js';
export { Viewport } from './viewport.js';
export type { ViewerState } from './state.js';

// Rendering engine - explicit exports for tree-shaking
export {
  WebGPUBackend,
  WebGL2Backend,
  WebGLBackend,
  Canvas2DBackend,
  TileManager,
  TileCache,
  ColorPipeline,
  LUT,
  ColorProfile,
} from '@tessera/rendering';
export type { TileSource } from '@tessera/rendering';

// Annotation system - explicit exports for tree-shaking
export {
  AnnotationStore,
  Transaction,
  RTree,
  PluginRegistry,
} from '@tessera/annotations';
export type {
  PointAnnotation,
  LineAnnotation,
  PolygonAnnotation,
  RectangleAnnotation,
  EllipseAnnotation,
  TextAnnotation,
  AnnotationTypeConfig,
} from '@tessera/annotations';

// Drawing and editing tools - explicit exports for tree-shaking
export {
  RectangleTool,
  EllipseTool,
  PolygonTool,
  FreehandTool,
  TextTool,
  VertexTool,
  EdgeTool,
  TransformTool,
  BooleanTool,
  SelectTool,
  ToolStateMachine,
} from '@tessera/tools';

// Event system - explicit exports for tree-shaking
export { EventEmitter } from '@tessera/events';

// Units and calibration - explicit exports for tree-shaking
export {
  UnitRegistry,
  UNITS,
  SpatialCalibration,
  GrayscaleCalibration,
  ColorCalibration,
  MeasurementContext,
} from '@tessera/units';

// Geometry utilities - explicit exports for tree-shaking
export {
  Matrix,
  rotate,
  scale,
  translate,
  union,
  intersect,
  difference,
  xor,
  simplifyDouglasPeucker,
  smoothChaikin,
} from '@tessera/geometry';
export type {
  Point,
  Line,
  Polygon,
  Ellipse,
} from '@tessera/geometry';

// Text rendering and editing - explicit exports for tree-shaking
export {
  HarfBuzzShaping,
  GlyphAtlas,
  MSDFGenerator,
  EmojiAtlas,
  TextLayout,
  wrapText,
  Caret,
  TextSelection,
} from '@tessera/text';

// Overlay graph system - explicit exports for tree-shaking
// (Currently empty, will be populated when implemented)

// Image format support - explicit exports for tree-shaking
export {
  TIFFParser,
  ZarrParser,
  DICOMParser,
  IIIFParser,
} from '@tessera/formats';

// Import plugins - explicit exports for tree-shaking
export {
  importGeoJSON,
  importWKT,
} from '@tessera/import';

// Export plugins - explicit exports for tree-shaking
export {
  exportGeoJSON,
  exportWKT,
  exportSVG,
  exportPDF,
} from '@tessera/export';

// Web Worker utilities - explicit exports for tree-shaking
export {
  FFTWorker,
  RANSACWorker,
  BooleanWorker,
} from '@tessera/workers';

// Shared utilities - explicit exports for tree-shaking
export {
  clamp,
  hexToRgb,
} from '@tessera/utils';

