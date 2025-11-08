/**
 * @tessera/annotations - Annotation system
 */

export { AnnotationStore } from './store/store.js';
export { Transaction } from './store/transaction.js';
export { RTree } from './spatial/rtree.js';
export type { PointAnnotation } from './types/point.js';
export type { LineAnnotation } from './types/line.js';
export type { PolygonAnnotation } from './types/polygon.js';
export type { RectangleAnnotation } from './types/rectangle.js';
export type { EllipseAnnotation } from './types/ellipse.js';
export type { TextAnnotation } from './types/text.js';
export { PluginRegistry } from './plugins/registry.js';
export type { AnnotationTypeConfig } from './plugins/types.js';

