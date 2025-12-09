import jsPDF from 'jspdf';
import { CropState, DPI_300_PPCM, SPECS, GeneratedFile } from '../types';

/**
 * Creates an off-screen canvas, draws the cropped image at high resolution,
 * and returns the data URL.
 * 
 * Logic Update:
 * We now accept `referenceWidthPx` which corresponds to the "viewWidth" from the editor.
 * The `crop.x` and `crop.y` are pixel offsets relative to the center of that reference width.
 * We must scale these offsets to the new high-res target width.
 */
const generateHighResCanvas = (
  image: HTMLImageElement,
  crop: CropState,
  targetWidthPx: number,
  targetHeightPx: number,
  referenceWidthPx: number // The width of the "safe zone" or "bleed box" in the preview
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidthPx;
    canvas.height = targetHeightPx;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // Quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Calculate the Ratio between Output and Preview
    // This dictates how much we scale coordinates and sizes.
    const ratio = targetWidthPx / referenceWidthPx;

    // 2. Calculate Draw Dimensions
    // In Editor: drawW = image.naturalWidth * (referenceWidthPx / image.naturalWidth) * crop.scale
    // Simplified: drawW = referenceWidthPx * crop.scale
    // Therefore in High Res:
    const scaledImageWidth = (referenceWidthPx * crop.scale) * ratio;
    const scaledImageHeight = (scaledImageWidth / image.naturalWidth) * image.naturalHeight;

    // 3. Calculate Draw Position
    // We render from the Center.
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // The crop.x/y are offsets in "Preview Pixels" from the center.
    // We convert them to "Target Pixels".
    const offsetX = crop.x * ratio;
    const offsetY = crop.y * ratio;

    const drawX = centerX - (scaledImageWidth / 2) + offsetX;
    const drawY = centerY - (scaledImageHeight / 2) + offsetY;

    // Fill background white (safety)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(image, drawX, drawY, scaledImageWidth, scaledImageHeight);

    // Return as JPEG for PDF (standard compression)
    resolve(canvas.toDataURL('image/jpeg', 0.95));
  });
};

const generateWebPCanvas = (
  image: HTMLImageElement,
  crop: CropState,
  referenceWidthPx: number,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const { widthPx, heightPx } = SPECS.WebP;
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');

    if (!ctx) return reject('No Context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // For WebP, the target width is 912px.
    // The Preview was based on A1 aspect ratio.
    // However, the user centered the image visually.
    // We apply the exact same "Center + Offset" logic to the WebP frame.
    
    // We treat the WebP width as the target width for scaling purposes to maintain relative zoom?
    // Actually, if we want WYSIWYG zoom, scale is relative to the Frame Width.
    // If the WebP frame is narrower than A1 relative to image, it fits differently.
    // But usually "100% zoom" means "Fits width".
    // Let's preserve the scale relative to the width of the output format.
    
    const ratio = widthPx / referenceWidthPx;
    
    // Recalculate dimensions for this target
    const scaledImageWidth = (referenceWidthPx * crop.scale) * ratio;
    const scaledImageHeight = (scaledImageWidth / image.naturalWidth) * image.naturalHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const offsetX = crop.x * ratio;
    const offsetY = crop.y * ratio;

    const drawX = centerX - (scaledImageWidth / 2) + offsetX;
    const drawY = centerY - (scaledImageHeight / 2) + offsetY;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    
    ctx.drawImage(image, drawX, drawY, scaledImageWidth, scaledImageHeight);

    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject('Blob creation failed');
    }, 'image/webp', 0.9);
  });
};

export const processExports = async (
  image: HTMLImageElement,
  crop: CropState,
  referenceWidthPx: number, // PASSED FROM EDITOR LAYOUT
  _unusedHeight: number,    // Deprecated
  baseFilename: string
): Promise<GeneratedFile[]> => {
  const baseName = baseFilename;
  const results: GeneratedFile[] = [];

  // --- 1. Generate A1 PDF ---
  // A1 Dimensions in CM + Bleed
  const a1BleedCm = SPECS.A1.bleedMm / 10;
  const a1TotalWidthCm = SPECS.A1.widthCm + (a1BleedCm * 2);
  const a1TotalHeightCm = SPECS.A1.heightCm + (a1BleedCm * 2);
  
  const a1WidthPx = Math.ceil(a1TotalWidthCm * DPI_300_PPCM);
  const a1HeightPx = Math.ceil(a1TotalHeightCm * DPI_300_PPCM);

  const a1DataUrl = await generateHighResCanvas(image, crop, a1WidthPx, a1HeightPx, referenceWidthPx);
  
  const pdfA1 = new jsPDF({
    orientation: 'p',
    unit: 'cm',
    format: [a1TotalWidthCm, a1TotalHeightCm],
    compress: true
  });
  
  pdfA1.addImage(a1DataUrl, 'JPEG', 0, 0, a1TotalWidthCm, a1TotalHeightCm, undefined, 'FAST');
  
  results.push({
    name: `${baseName}_A1_Bleed.pdf`,
    blob: pdfA1.output('blob'),
    url: URL.createObjectURL(pdfA1.output('blob')),
    type: 'pdf',
    dimensions: '60 x 84.7 cm (+3mm bleed)'
  });

  // --- 2. Generate A2 PDF ---
  const a2BleedCm = SPECS.A2.bleedMm / 10;
  const a2TotalWidthCm = SPECS.A2.widthCm + (a2BleedCm * 2);
  const a2TotalHeightCm = SPECS.A2.heightCm + (a2BleedCm * 2);

  const a2WidthPx = Math.ceil(a2TotalWidthCm * DPI_300_PPCM);
  const a2HeightPx = Math.ceil(a2TotalHeightCm * DPI_300_PPCM);

  const a2DataUrl = await generateHighResCanvas(image, crop, a2WidthPx, a2HeightPx, referenceWidthPx);

  const pdfA2 = new jsPDF({
    orientation: 'p',
    unit: 'cm',
    format: [a2TotalWidthCm, a2TotalHeightCm],
    compress: true
  });

  pdfA2.addImage(a2DataUrl, 'JPEG', 0, 0, a2TotalWidthCm, a2TotalHeightCm, undefined, 'FAST');

  results.push({
    name: `${baseName}_A2_Bleed.pdf`,
    blob: pdfA2.output('blob'),
    url: URL.createObjectURL(pdfA2.output('blob')),
    type: 'pdf',
    dimensions: '42.6 x 60 cm (+3mm bleed)'
  });

  // --- 3. Generate WebP ---
  const webpBlob = await generateWebPCanvas(image, crop, referenceWidthPx);
  results.push({
    name: `${baseName}_web.webp`,
    blob: webpBlob,
    url: URL.createObjectURL(webpBlob),
    type: 'webp',
    dimensions: '912 x 1296 px'
  });

  return results;
};