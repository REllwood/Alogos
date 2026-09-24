import { ImageData } from './types';
import { rgbToLuminance } from './luminance';

/**
 * Memory-efficient luminance storage used by the detector
 *
 * The public helpers in `luminance.ts` and `gradients.ts` build nested arrays
 * (one array per row), which is convenient for inspection but costs hundreds
 * of megabytes for a phone photo. The detector instead keeps luminance in a
 * single typed array and computes gradients on the fly (see `features.ts`).
 */

/**
 * Single-channel image stored row-major in a typed array
 */
export interface LuminancePlane {
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Converts RGBA image data to a luminance plane
 *
 * @param imageData - Image data with RGBA pixel values
 * @returns Luminance plane (0-255)
 */
export function luminancePlane(imageData: ImageData): LuminancePlane {
  const { width, height, data } = imageData;
  const plane = new Float32Array(width * height);

  for (let i = 0, j = 0; i < plane.length; i++, j += 4) {
    plane[i] = rgbToLuminance(data[j], data[j + 1], data[j + 2]);
  }

  return { data: plane, width, height };
}
