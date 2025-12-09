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

// 300 DPI conversion factor (Pixels per CM)
// 300 pixels / 1 inch (2.54cm) ~= 118.1102
export const DPI_300_PPCM = 118.1102;

// Output Specifications
export const SPECS = {
  A1: {
    widthCm: 60,
    heightCm: 84.7,
    bleedMm: 3,
  },
  A2: {
    widthCm: 42.6,
    heightCm: 60,
    bleedMm: 3,
  },
  WebP: {
    widthPx: 912,
    heightPx: 1296,
  }
};
