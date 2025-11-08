# Units System

## Overview

The units system provides unit-aware measurements and coordinate transformations. It supports multiple coordinate spaces and a pluggable unit registry.

## Coordinate Spaces

### 1. Image Space (Primary)
**Purpose**: Stable coordinate system tied to image pixels

**Characteristics**:
- Coordinates in image pixels
- Stable under zoom/pan
- Used for all annotation geometry
- Survives viewport changes

**Example**: `{ x: 18234, y: 9043 }` (image pixel coordinates)

### 2. Screen Space (Secondary)
**Purpose**: Viewport coordinates (CSS pixels)

**Characteristics**:
- Coordinates in CSS pixels
- Changes with zoom/pan
- Used for UI overlays, cursors
- Device pixel ratio aware

**Example**: `{ x: 450, y: 320 }` (screen pixel coordinates)

## Unit Registry

### Purpose
Pluggable unit system for length, area, angle, and scale measurements

### Unit Definition
```typescript
interface UnitDef {
  id: string;              // 'µm', 'mm', 'px', 'in', etc.
  kind: 'length' | 'area' | 'angle' | 'scale';
  toSI(v: number): number;  // Convert to SI (meters, m², radians)
  fromSI(v: number): number;
  format?(v: number): string;  // Optional formatter
  stepHint?: number[];      // Nice ruler ticks
}
```

### Built-in Units

#### Length Units
- `px`: Pixels (image or screen)
- `µm`: Micrometers
- `mm`: Millimeters
- `cm`: Centimeters
- `m`: Meters
- `in`: Inches
- `pt`: Points (1/72 inch)

#### Area Units
- `px²`: Square pixels
- `µm²`: Square micrometers
- `mm²`: Square millimeters
- `cm²`: Square centimeters
- `m²`: Square meters
- `in²`: Square inches

#### Angle Units
- `deg`: Degrees
- `rad`: Radians
- `arcmin`: Arc minutes
- `arcsec`: Arc seconds

### Registering Custom Units
```typescript
viewer.units.register({
  id: 'mils',
  kind: 'length',
  toSI: (v) => v * 0.0000254,  // mils to meters
  fromSI: (v) => v / 0.0000254,
  format: (v) => `${v.toFixed(2)} mils`
});
```

## Pixel Spacing

### Purpose
Convert image pixels to physical units (mm, µm, etc.)

### Storage
```typescript
interface PixelSpacing {
  unit: 'mm' | 'µm' | 'nm';
  x: number;  // Physical units per pixel (X axis)
  y: number;  // Physical units per pixel (Y axis)
}
```

### Anisotropic Pixels
Support for non-square pixels (X ≠ Y spacing):
```typescript
viewer.setPixelSpacing({
  unit: 'µm',
  x: 0.252,  // 0.252 µm per pixel (X)
  y: 0.256   // 0.256 µm per pixel (Y)
});
```

### Sources
- **DICOM**: `PixelSpacing` tag `[rowSpacing, columnSpacing]`
- **OME-TIFF**: `PhysicalSizeX`, `PhysicalSizeY` (in µm)
- **IIIF**: Metadata like `mm_per_pixel`
- **Calibration**: Auto-detected from rulers/grids

## Measurement Context

### Purpose
Configure how measurements are computed and displayed

### Context Structure
```typescript
interface MeasurementContext {
  // Source calibration
  pixelSpacing: PixelSpacing;
  anisotropy?: boolean;  // If x ≠ y
  
  // Preferred output units
  lengthUnit: string;    // 'µm' | 'mm' | 'px' | 'in'
  areaUnit: string;      // 'mm²' | 'µm²' | 'px²'
  angleUnit: string;     // 'deg' | 'rad'
  
  // Formatting & rounding
  rounding: {
    lengthDecimals?: number;
    adaptive?: boolean;  // Auto-switch units (µm ↔ mm)
    areaDecimals?: number;
    angleDecimals?: number;
  };
  
  // Policies
  allowNonSquarePixels?: boolean;
  lengthMetric?: 'euclidean' | 'taxicab';
}
```

### Context Precedence
1. Tool override (most specific)
2. Annotation override
3. Layer/source override
4. Viewer/global default

### Example
```typescript
// Global default
viewer.units.setDefault({
  lengthUnit: 'µm',
  areaUnit: 'µm²',
  angleUnit: 'deg',
  rounding: { adaptive: true }
});

// Tool override
viewer.tools.configure('ruler.mac', {
  lengthUnit: 'in',
  rounding: { lengthDecimals: 2 }
});
```

## Unit Conversions

### Conversion API
```typescript
// Image pixels → physical length
const Lx_mm = dx_px * ctx.pixelSpacing.x;
const Ly_mm = dy_px * ctx.pixelSpacing.y;

// Euclidean length (accounting for anisotropy)
const length_mm = Math.hypot(Lx_mm, Ly_mm);

// Convert to user's preferred unit
const length_out = viewer.units.convert(length_mm, 'mm', ctx.lengthUnit);

// Areas
const area_mm2 = (dx_px * ctx.pixelSpacing.x) * (dy_px * ctx.pixelSpacing.y);
const area_out = viewer.units.convert(area_mm2, 'mm²', ctx.areaUnit);
```

### Conversion Helpers
```typescript
// Direct conversion
const value = viewer.units.convert(2.345, 'mm', 'µm');  // 2345

// Format with unit
const formatted = viewer.readout.length(2.34567, 'mm', ctx);  // "2.35 mm"
```

## Readouts & Formatting

### Readout Service
```typescript
interface ReadoutService {
  length(value: number, unit: string, ctx: MeasurementContext): string;
  area(value: number, unit: string, ctx: MeasurementContext): string;
  angle(value: number, unit: string, ctx: MeasurementContext): string;
}
```

### Adaptive Formatting
Automatically switch units for readability:
- `< 0.001 µm` → show in nm
- `< 1 mm` → show in µm
- `< 10 cm` → show in mm
- `≥ 10 cm` → show in cm

### Example
```typescript
viewer.readout.length(0.0852, 'mm', ctx);  // "85.2 µm" (adaptive)
viewer.readout.length(2.34, 'mm', ctx);    // "2.34 mm"
viewer.readout.length(12.5, 'mm', ctx);    // "1.25 cm" (adaptive)
```

## Scale Bars

### Purpose
Display scale bar overlay showing physical size

### Generation
```typescript
const scaleBar = viewer.scaleBar.generate({
  unit: 'µm',           // Target unit
  length: 100,          // Desired length (µm)
  position: 'bottom-right',
  style: { color: '#fff', width: 2 }
});
```

### Dynamic Scale Bar
Automatically computes appropriate length:
```typescript
// Choose "nice" length based on current zoom
const scaleBar = viewer.scaleBar.generate({
  unit: 'µm',
  nice: true,  // Auto-select nice length
  position: 'bottom-right'
});
```

### Scale Bar Calculation
```typescript
// Compute µm per screen pixel
const µmPerScreenPx = spacingX * (1 / zoom);

// Choose nice round length
const scaleBarLengthPx = chooseNiceRound(µmPerScreenPx);

// Label
const label = formatLabel(scaleBarLengthPx * µmPerScreenPx);  // "100 µm"
```

## Calibration Tools

### Spatial Calibration
Auto-detect pixel spacing from rulers/grids

**Inputs**:
- ROI covering ruler/grid
- Reference length or grid pitch

**Algorithm**:
1. Detect ruler ticks or grid intersections
2. Measure pixel spacing between ticks
3. Compute physical spacing
4. Return uncertainty and error %

**Output**:
```typescript
{
  spatialCalibration: {
    unit: "µm",
    scaleX: 0.252,
    scaleY: 0.252,
    rotationDeg: 0.08,
    residualPx: 0.12,
    errorPercent: 0.48,
    method: "grid-fft+ransac",
    confidence: 0.95
  }
}
```

**API**:
```typescript
const result = await viewer.calibration.spatial.run({
  roi: userRect,  // or 'auto'
  reference: { pitch: 10, unit: 'µm' }
});

if (result.errorPercent <= 1.0) {
  viewer.setPixelSpacing(result);
}
```

## Screen-Space Controls

### Purpose
Allow screen-space constraints for UX (while keeping geometry in image space)

### Supported Pseudo-Units
- `px-screen`: CSS pixels
- `px-image`: Image pixels
- Any registered physical unit (µm, mm, etc.)

### Example
```typescript
viewer.interaction.configure({
  handleHitTolerance: { unit: 'px-screen', value: 6 },
  snap: {
    grid: { unit: 'µm', step: 10 },
    angle: { unit: 'deg', step: 15 }
  },
  minSegmentLength: { unit: 'px-image', value: 1 }
});
```

## Multiple Sources / Mosaics

### Different Spacings
When viewport hosts layers with different pixel spacing:

```typescript
// Store spacing per layer
viewer.layers.add({
  id: 'layer1',
  source: source1,
  pixelSpacing: { unit: 'µm', x: 0.25, y: 0.25 }
});

// Measurement context picks active layer's spacing
viewer.measure.with((ctx) => ({
  ...ctx,
  pixelSpacing: viewer.layers.active().pixelSpacing
}));
```

## Advanced Features

### Custom Formatters
```typescript
viewer.units.setFormatter('µm', (v) => {
  return v < 1 ? `${(v * 1000).toFixed(1)} nm` : `${v.toFixed(2)} µm`;
});
```

### Spatial Transforms
Custom projections for distortion correction:
```typescript
viewer.measure.setSpatialTransform(layerId, {
  kind: 'affine',  // or 'poly2'
  toWorld(pxPt) { /* ... */ },
  fromWorld(worldPt) { /* ... */ }
});
```

### Policy Guards
```typescript
viewer.units.setPolicy({
  diagnostic: {
    allowScreenSpaceUnits: false,  // Only image-space
    requireCalibration: true,
    maxErrorPercent: 1.0
  }
});
```

## Unit Hierarchy

### Auto-Labeling Thresholds
| Unit | Threshold | Example |
|------|-----------|---------|
| nm   | < 0.001 µm | 500 nm |
| µm   | < 1 mm     | 85.2 µm |
| mm   | < 10 cm    | 2.34 mm |
| cm   | otherwise  | 1.2 cm |

## API Reference

### Unit Registry
```typescript
interface UnitRegistry {
  register(unit: UnitDef): void;
  convert(value: number, from: string, to: string): number;
  format(value: number, unit: string, ctx: MeasurementContext): string;
  getUnit(id: string): UnitDef | undefined;
  setDefault(context: Partial<MeasurementContext>): void;
}
```

### Measurement Context
```typescript
interface MeasurementContext {
  pixelSpacing: PixelSpacing;
  lengthUnit: string;
  areaUnit: string;
  angleUnit: string;
  rounding: RoundingOptions;
  // ... (see above)
}
```

