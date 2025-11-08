# Color Management

## Overview

Color management ensures accurate color reproduction for medical and scientific imaging. The system supports color profiles, LUTs, and strict mode for diagnostic use.

## Color Pipeline

### Pipeline Stages

```
Source Image (various color spaces)
    ↓
[1] Convert to Linear RGB (via source profile)
    ↓
[2] Apply VOI LUT (if grayscale, window/level)
    ↓
[3] Apply GSDF (if enabled, grayscale standardization)
    ↓
[4] Apply display profile (if provided)
    ↓
[5] Convert to sRGB (for display)
    ↓
[6] Render to canvas (with proper gamma)
```

### 1. Source Color Space Conversion

**Purpose**: Convert from source color space to linear RGB

**Supported Source Spaces**:
- sRGB
- Adobe RGB
- ProPhoto RGB
- Grayscale (various bit depths)
- Custom ICC profiles

**Implementation**:
```typescript
viewer.color.setSourceProfile(iccProfile);
// Or use built-in profiles
viewer.color.setSourceProfile('sRGB');
viewer.color.setSourceProfile('grayscale');
```

### 2. VOI LUT (Window/Level)

**Purpose**: Adjust grayscale display range for medical images

**VOI (Value of Interest)**: Window width and level center

**Implementation**:
```typescript
viewer.color.applyVOILUT({
  windowWidth: 400,
  windowCenter: 50,
  bitDepth: 16
});
```

**Formula**:
```
output = clamp((input - (center - width/2)) / width * maxValue, 0, maxValue)
```

### 3. GSDF (Grayscale Standard Display Function)

**Purpose**: Ensure consistent grayscale perception across displays

**Standard**: DICOM Part 14 GSDF

**Implementation**:
```typescript
viewer.color.applyGSDF(true);
```

**Benefits**:
- Consistent appearance across monitors
- Just-noticeable-difference (JND) steps
- Medical-grade accuracy

### 4. Display Profile

**Purpose**: Account for display color characteristics

**Note**: Browser cannot read monitor ICC, but can apply user-provided profile

**Implementation**:
```typescript
viewer.color.setDisplayProfile(displayICCProfile);
```

### 5. Final Conversion to sRGB

**Purpose**: Convert to standard web color space

**Implementation**: Automatic, handled by pipeline

## Color Spaces

### Working Space: Linear RGB

**Why Linear?**
- Correct blending and compositing
- Accurate LUT application
- Physically correct rendering

**Storage**: All intermediate calculations in linear RGB

### Display Space: sRGB

**Why sRGB?**
- Standard web color space
- Browser default
- Wide compatibility

## Strict Mode

### Purpose
Ensure color accuracy for diagnostic use

### Behavior
- **Blocks rendering** if calibration fails
- **Enforces** linear working space
- **Validates** color pipeline
- **Records** all transforms for audit

### Configuration
```typescript
viewer.color.setStrictMode(true);
viewer.color.setPolicy({
  requireLinearSpace: true,
  requireGSDF: true,  // For grayscale
  maxDeltaE00: 1.5,   // For color
  blockOnFailure: true
});
```

### Validation
- Verify linear space usage
- Check LUT application
- Validate profile conversions
- Measure color accuracy (ΔE)

## VOI LUT (Window/Level)

### Medical Use Case
DICOM images often have 12-16 bit depth, but displays show 8 bits. VOI LUT maps the relevant range to display.

### Parameters
- **Window Width**: Range of values to display
- **Window Center**: Center of the window
- **Bit Depth**: Input bit depth (8, 10, 12, 16)

### Example
```typescript
// Show values from 0-400, centered at 50
viewer.color.applyVOILUT({
  windowWidth: 400,
  windowCenter: 50,
  bitDepth: 16
});

// Full range (no windowing)
viewer.color.applyVOILUT({
  windowWidth: 65535,  // Max for 16-bit
  windowCenter: 32767,
  bitDepth: 16
});
```

### Presets
Common presets for different tissue types:
```typescript
viewer.color.setVOIPreset('lung');
viewer.color.setVOIPreset('bone');
viewer.color.setVOIPreset('brain');
```

## GSDF (Grayscale Standard Display Function)

### Purpose
Standardize grayscale display so that the same image looks the same on different monitors.

### Standard
DICOM Part 14 (PS3.14) Grayscale Standard Display Function

### Implementation
- LUT that maps digital values to display luminance
- Ensures JND (Just Noticeable Difference) steps
- Calibrated to human visual perception

### Usage
```typescript
// Enable GSDF
viewer.color.applyGSDF(true);

// Verify GSDF application
const verified = await viewer.calibration.grayscale.verify({ gsdf: true });
if (verified.pass) {
  console.log('GSDF correctly applied');
}
```

## ICC Profile Support

### Source Profiles
Load ICC profiles for source images:
```typescript
// From file
const profile = await loadICCProfile('source.icc');
viewer.color.setSourceProfile(profile);

// Built-in
viewer.color.setSourceProfile('sRGB');
viewer.color.setSourceProfile('AdobeRGB');
viewer.color.setSourceProfile('ProPhotoRGB');
```

### Display Profiles
Apply display ICC profile (user-provided):
```typescript
const displayProfile = await loadICCProfile('display.icc');
viewer.color.setDisplayProfile(displayProfile);
```

**Note**: Browser cannot read monitor ICC automatically. User must provide profile or use OS-level color management.

## Color Calibration

### Purpose
Verify color accuracy and optionally correct deviations

### Color Verification
```typescript
const result = await viewer.calibration.color.verify({
  chart: 'ColorChecker24',
  rois: [rect1, rect2, ...]  // ROIs covering color patches
});

console.log('Mean ΔE00:', result.deltaE00.mean);
console.log('Max ΔE00:', result.deltaE00.max);
console.log('95th percentile:', result.deltaE00.p95);
```

### Output
```typescript
interface ColorVerificationResult {
  deltaE00: {
    mean: number;
    p95: number;
    max: number;
  };
  patches: Array<{
    id: string;
    dE00: number;
  }>;
  suggestedLUT?: string;  // Optional correction LUT
}
```

### Thresholds
```typescript
viewer.calibration.setPolicy({
  color: {
    maxMeanDeltaE00: 1.5,
    max95DeltaE00: 3.0,
    mode: 'diagnostic'  // or 'advisory'
  }
});
```

## Grayscale Calibration

### Purpose
Verify grayscale rendering accuracy

### Verification
```typescript
const result = await viewer.calibration.grayscale.verify({
  gsdf: true,
  testPattern: 'jnd-ramp'  // or use current image
});

console.log('Banding score:', result.bandingScore);
console.log('Pass:', result.pass);
```

### Output
```typescript
interface GrayscaleVerificationResult {
  pass: boolean;
  bandingScore: number;  // Lower is better
  monotonicity: boolean;
  suggestedBitDepth?: number;
  suggestedDither?: boolean;
}
```

## Premultiplied Alpha

### Purpose
Correct compositing of transparent overlays

### Implementation
- All blending uses premultiplied alpha
- Colors are multiplied by alpha before blending
- Prevents color bleeding and darkening

### Formula
```
premultiplied = { r: r * a, g: g * a, b: b * a, a: a }
blended = src_premultiplied + dst * (1 - src.a)
```

## Color in Annotations

### Annotation Colors
- All annotation colors specified in linear RGB
- Converted to sRGB for display
- Stored in annotation style

### Style Colors
```typescript
interface Style {
  stroke: string;  // Hex or RGB, interpreted as linear
  fill: string | FillDef;
  // ...
}
```

### Color Picker
Application should provide color picker that:
- Works in linear space (or converts)
- Shows sRGB preview
- Supports color profiles

## Performance Considerations

### LUT Caching
- Cache computed LUTs
- Invalidate on profile/LUT change
- Use texture LUTs for GPU backends

### Profile Conversion
- Pre-compute conversion matrices
- Cache matrix lookups
- Use GPU for bulk conversions

### Memory
- LUTs stored as textures (GPU) or arrays (CPU)
- Profile data cached
- Release resources on cleanup

## API Reference

### Color System
```typescript
interface ColorSystem {
  // Profiles
  setSourceProfile(profile: ICCProfile | string): void;
  setDisplayProfile(profile: ICCProfile | string): void;
  
  // LUTs
  applyVOILUT(lut: VOILUT): void;
  applyGSDF(enabled: boolean): void;
  
  // Mode
  setStrictMode(enabled: boolean): void;
  setPolicy(policy: ColorPolicy): void;
  
  // Conversion
  convert(color: Color, from: ColorSpace, to: ColorSpace): Color;
  
  // Calibration
  calibration: {
    color: ColorCalibration;
    grayscale: GrayscaleCalibration;
  };
}
```

### VOI LUT
```typescript
interface VOILUT {
  windowWidth: number;
  windowCenter: number;
  bitDepth: 8 | 10 | 12 | 16;
  rescaleSlope?: number;
  rescaleIntercept?: number;
}
```

### Color Policy
```typescript
interface ColorPolicy {
  requireLinearSpace?: boolean;
  requireGSDF?: boolean;
  maxDeltaE00?: number;
  blockOnFailure?: boolean;
  mode?: 'diagnostic' | 'advisory';
}
```

## Best Practices

### For Medical Imaging
1. **Always use strict mode** in diagnostic workflows
2. **Enable GSDF** for grayscale images
3. **Calibrate displays** (user responsibility, but verify in app)
4. **Record calibration** in audit trail
5. **Never modify source pixels** (use overlays)

### For General Use
1. **Use sRGB** as default (widest compatibility)
2. **Apply VOI LUT** for high bit-depth images
3. **Provide presets** for common window/level settings
4. **Allow user override** of color settings

### For Development
1. **Test on multiple displays** (different gamuts)
2. **Verify color accuracy** with test patterns
3. **Profile your workflow** (source → display)
4. **Document color settings** in metadata

