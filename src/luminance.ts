import { ImageData } from './types';

/**
 * Converts RGB values to luminance using the standard photometric formula
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * 
 * These coefficients account for human perception sensitivity to different colours
 * 
 * @param r - Red channel value (0-255)
 * @param g - Green channel value (0-255)
 * @param b - Blue channel value (0-255)
 * @returns Luminance value (0-255)
 */
export function rgbToLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Converts an entire image from RGBA to a 2D luminance matrix
 * 
 * @param imageData - Image data with RGBA pixel values
 * @returns 2D array of luminance values
 */
export function imageToLuminanceMatrix(imageData: ImageData): number[][] {
  const { width, height, data } = imageData;
  const luminanceMatrix: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4; // RGBA format, 4 bytes per pixel
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Alpha channel (data[idx + 3]) is ignored for luminance calculation
      
      row.push(rgbToLuminance(r, g, b));
    }
    luminanceMatrix.push(row);
  }

  return luminanceMatrix;
}

/**
 * Converts an entire image from RGBA to a 2D luminance matrix
 *
 * @deprecated Use {@link imageToLuminanceMatrix}. This alias with its original
 * lower-case "l" is kept so existing code keeps working.
 */
export const imageToluminanceMatrix = imageToLuminanceMatrix;

/**
 * Normalises luminance values to the range [0, 1]
 * 
 * @param luminanceMatrix - 2D array of luminance values
 * @returns Normalised luminance matrix
 */
export function normaliseLuminance(luminanceMatrix: number[][]): number[][] {
  const height = luminanceMatrix.length;
  if (height === 0) return [];
  
  const width = luminanceMatrix[0].length;
  if (width === 0) return [];

  // Find min and max values
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = luminanceMatrix[y][x];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  // Avoid division by zero
  const range = max - min;
  if (range === 0) {
    return luminanceMatrix.map(row => row.map(() => 0));
  }

  // Normalise
  return luminanceMatrix.map(row =>
    row.map(value => (value - min) / range)
  );
}

/**
 * Applies a 3 × 3 unsharp-mask filter: L + 0.5 × (L − local mean)
 *
 * @deprecated Not used by the detector. This was described as a high-pass
 * filter that reduces JPEG block artefacts, but it sharpens the image, which
 * strengthens block edges rather than suppressing them. Kept only for
 * backwards compatibility.
 *
 * @param luminanceMatrix - 2D array of luminance values
 * @returns Filtered luminance matrix (edge pixels unchanged)
 */
export function filterCompressionArtifacts(luminanceMatrix: number[][]): number[][] {
  const height = luminanceMatrix.length;
  if (height === 0) return [];
  
  const width = luminanceMatrix[0].length;
  if (width === 0 || height < 3 || width < 3) return luminanceMatrix;

  const filtered: number[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        // Keep edges as-is
        row.push(luminanceMatrix[y][x]);
      } else {
        // Unsharp mask: push each pixel away from its local mean
        const localMean = (
          luminanceMatrix[y - 1][x - 1] + luminanceMatrix[y - 1][x] + luminanceMatrix[y - 1][x + 1] +
          luminanceMatrix[y][x - 1] + luminanceMatrix[y][x] + luminanceMatrix[y][x + 1] +
          luminanceMatrix[y + 1][x - 1] + luminanceMatrix[y + 1][x] + luminanceMatrix[y + 1][x + 1]
        ) / 9;
        
        // Keep the high-frequency component
        const highFreq = luminanceMatrix[y][x] - localMean;
        row.push(luminanceMatrix[y][x] + highFreq * 0.5);
      }
    }
    filtered.push(row);
  }

  return filtered;
}

