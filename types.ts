export interface Dimensions {
  width: number;
  height: number;
}

export interface CropState {
  x: number; // Offset X in pixels
  y: number; // Offset Y in pixels
  scale: number; // Zoom level
}

export interface GeneratedFile {
  name: string;
  blob: Blob;
  url: string;
  type: 'pdf' | 'webp';
  dimensions: string;
}

export interface BatchResult {
  originalName: string;
  files: GeneratedFile[];
}

// 300 DPI conversion factor (Pixels per CM)
// 300 pixels / 1 inch (2.54cm) ~= 118.1102
export const DPI_300_PPCM = 118.1102;

// Output Specifications
// Corrected to ISO Standard "Trim" sizes.
// The service adds 3mm bleed to these, resulting in:
// A1: 59.4 + 0.6 = 60.0cm width
// A2: 42.0 + 0.6 = 42.6cm width
export const SPECS = {
  A1: {
    widthCm: 59.4,
    heightCm: 84.1,
    bleedMm: 3,
  },
  A2: {
    widthCm: 42.0,
    heightCm: 59.4,
    bleedMm: 3,
  },
  WebP: {
    widthPx: 912,
    heightPx: 1296,
  }
};