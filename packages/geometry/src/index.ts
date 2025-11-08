/**
 * @tessera/geometry - 2D geometry operations
 */

export type { Point } from './primitives/point.js';
export type { Line } from './primitives/line.js';
export type { Polygon } from './primitives/polygon.js';
export type { Ellipse } from './primitives/ellipse.js';
export { Matrix } from './transforms/matrix.js';
export { rotate } from './transforms/rotate.js';
export { scale } from './transforms/scale.js';
export { translate } from './transforms/translate.js';
export { union } from './boolean/union.js';
export { intersect } from './boolean/intersect.js';
export { difference } from './boolean/difference.js';
export { xor } from './boolean/xor.js';
export { simplifyDouglasPeucker } from './simplify/douglas-peucker.js';
export { smoothChaikin } from './smooth/chaikin.js';

