import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { CropState, DPI_300_PPCM, SPECS, GeneratedFile, BatchResult } from '../types';

/**
 * Creates an off-screen canvas, draws the cropped image at high resolution,
 * and returns the data as Uint8Array (to avoid large Base64 strings in memory).
 */
const generateHighResCanvas = (
  image: HTMLImageElement,
  crop: CropState,
  targetWidthPx: number,
  targetHeightPx: number,
  referenceWidthPx: number // The width of the "safe zone" or "bleed box" in the preview
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidthPx;
    canvas.height = targetHeightPx;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
    }

    // Quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Calculate the Ratio between Output and Preview
    const ratio = targetWidthPx / referenceWidthPx;

    // 2. Calculate Draw Dimensions
    // In Editor: drawW = image.naturalWidth * (referenceWidthPx / image.naturalWidth) * crop.scale
    // Simplified: drawW = referenceWidthPx * crop.scale
    // Therefore in High Res:
    const scaledImageWidth = (referenceWidthPx * crop.scale) * ratio;
    const scaledImageHeight = (scaledImageWidth / image.naturalWidth) * image.naturalHeight;

    // 3. Calculate Draw Position
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const offsetX = crop.x * ratio;
    const offsetY = crop.y * ratio;

    const drawX = centerX - (scaledImageWidth / 2) + offsetX;
    const drawY = centerY - (scaledImageHeight / 2) + offsetY;

    // Fill background white (safety)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(image, drawX, drawY, scaledImageWidth, scaledImageHeight);

    // Optimize: Convert to Blob -> ArrayBuffer -> Uint8Array
    // This bypasses strict string length limits associated with .toDataURL() base64 strings
    canvas.toBlob(
        (blob) => {
            if (!blob) {
                reject(new Error('Canvas to Blob failed'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                    resolve(new Uint8Array(reader.result));
                } else {
                    reject(new Error('Failed to convert blob to array buffer'));
                }
            };
            reader.onerror = () => reject(new Error('FileReader error during canvas export'));
            reader.readAsArrayBuffer(blob);
        },
        'image/jpeg',
        0.95
    );
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

  const a1Data = await generateHighResCanvas(image, crop, a1WidthPx, a1HeightPx, referenceWidthPx);
  
  const pdfA1 = new jsPDF({
    orientation: 'p',
    unit: 'cm',
    format: [a1TotalWidthCm, a1TotalHeightCm],
    compress: true
  });
  
  // Passed as Uint8Array, type 'JPEG'
  pdfA1.addImage(a1Data, 'JPEG', 0, 0, a1TotalWidthCm, a1TotalHeightCm, undefined, 'FAST');
  
  results.push({
    name: `${baseName}_A1.pdf`,
    blob: pdfA1.output('blob'),
    url: URL.createObjectURL(pdfA1.output('blob')),
    type: 'pdf',
    dimensions: '60 x 84.7 cm (incl. 3mm bleed)'
  });

  // --- 2. Generate A2 PDF ---
  const a2BleedCm = SPECS.A2.bleedMm / 10;
  const a2TotalWidthCm = SPECS.A2.widthCm + (a2BleedCm * 2);
  const a2TotalHeightCm = SPECS.A2.heightCm + (a2BleedCm * 2);

  const a2WidthPx = Math.ceil(a2TotalWidthCm * DPI_300_PPCM);
  const a2HeightPx = Math.ceil(a2TotalHeightCm * DPI_300_PPCM);

  const a2Data = await generateHighResCanvas(image, crop, a2WidthPx, a2HeightPx, referenceWidthPx);

  const pdfA2 = new jsPDF({
    orientation: 'p',
    unit: 'cm',
    format: [a2TotalWidthCm, a2TotalHeightCm],
    compress: true
  });

  pdfA2.addImage(a2Data, 'JPEG', 0, 0, a2TotalWidthCm, a2TotalHeightCm, undefined, 'FAST');

  results.push({
    name: `${baseName}_A2.pdf`,
    blob: pdfA2.output('blob'),
    url: URL.createObjectURL(pdfA2.output('blob')),
    type: 'pdf',
    dimensions: '42.6 x 60 cm (incl. 3mm bleed)'
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

export const generateZip = async (batchResults: BatchResult[]): Promise<Blob> => {
  const zip = new JSZip();

  batchResults.forEach(batch => {
    // If there is only 1 file, put them in root
    // If multiple, put them in folders? Or just prefix them.
    // Let's create a folder for each original image if batch > 1
    const folder = batchResults.length > 1 ? zip.folder(batch.originalName) : zip;
    
    if (folder) {
      batch.files.forEach(file => {
        folder.file(file.name, file.blob);
      });
    }
  });

  return await zip.generateAsync({ type: 'blob' });
};