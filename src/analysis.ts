import { ImageData } from './types';
import { rgbToLuminance } from './luminance';

/**
 * Internal, memory-efficient analysis pipeline used by the detector
 *
 * The public helpers in `luminance.ts`, `gradients.ts` and `pca.ts` build
 * nested arrays (one array per row or per pixel), which is convenient for
 * inspection but costs several copies of the image and hundreds of megabytes
 * for a phone photo. The functions here keep luminance in a single typed
 * array and compute gradients on the fly, so the gradient field is never
 * stored. They produce the same results as the public helpers.
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

/**
 * Applies the same 3 × 3 filter as `filterCompressionArtifacts` to a plane
 *
 * @param plane - Input luminance plane
 * @returns Filtered plane (edge pixels unchanged)
 */
export function filterPlane(plane: LuminancePlane): LuminancePlane {
  const { data: src, width, height } = plane;
  if (width < 3 || height < 3) return plane;

  const out = new Float32Array(src);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const localMean =
        (src[i - width - 1] +
          src[i - width] +
          src[i - width + 1] +
          src[i - 1] +
          src[i] +
          src[i + 1] +
          src[i + width - 1] +
          src[i + width] +
          src[i + width + 1]) /
        9;
      out[i] = src[i] + (src[i] - localMean) * 0.5;
    }
  }

  return { data: out, width, height };
}

/**
 * Rescales a plane to the range [0, 1] (all zeros if the plane is uniform)
 *
 * @param plane - Input luminance plane
 * @returns Normalised plane
 */
export function normalisePlane(plane: LuminancePlane): LuminancePlane {
  const { data: src, width, height } = plane;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < src.length; i++) {
    if (src[i] < min) min = src[i];
    if (src[i] > max) max = src[i];
  }

  const range = max - min;
  const out = new Float32Array(src.length);
  if (range > 0) {
    for (let i = 0; i < src.length; i++) out[i] = (src[i] - min) / range;
  }

  return { data: out, width, height };
}

/**
 * Horizontal gradient at a pixel: central difference in the interior,
 * forward/backward difference at the left/right edge (0 for a single column)
 */
function gradientX(src: Float32Array, width: number, x: number, i: number): number {
  if (width === 1) return 0;
  if (x === 0) return src[i + 1] - src[i];
  if (x === width - 1) return src[i] - src[i - 1];
  return (src[i + 1] - src[i - 1]) / 2;
}

/**
 * Vertical gradient at a pixel: central difference in the interior,
 * forward/backward difference at the top/bottom edge (0 for a single row)
 */
function gradientY(src: Float32Array, width: number, height: number, y: number, i: number): number {
  if (height === 1) return 0;
  if (y === 0) return src[i + width] - src[i];
  if (y === height - 1) return src[i] - src[i - width];
  return (src[i + width] - src[i - width]) / 2;
}

/**
 * Summary statistics of a plane's gradient field
 */
export interface GradientStatistics {
  /** Number of gradient samples */
  count: number;
  /** Mean horizontal and vertical gradient */
  mean: [number, number];
  /** 2 × 2 covariance matrix of the gradient vectors */
  covariance: number[][];
  /** Sum of gradient magnitudes */
  sumMagnitude: number;
}

/**
 * Computes gradient statistics in a single pass without storing the gradients
 *
 * @param plane - Luminance plane
 * @returns Mean, covariance and magnitude sum of the gradient vectors
 */
export function gradientStatistics(plane: LuminancePlane): GradientStatistics {
  const { data: src, width, height } = plane;
  const count = width * height;

  // Accumulate raw sums; covariance is formed from them at the end
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let sumMagnitude = 0;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const gx = gradientX(src, width, x, i);
      const gy = gradientY(src, width, height, y, i);
      sumX += gx;
      sumY += gy;
      sumXX += gx * gx;
      sumYY += gy * gy;
      sumXY += gx * gy;
      sumMagnitude += Math.sqrt(gx * gx + gy * gy);
    }
  }

  const meanX = sumX / count;
  const meanY = sumY / count;
  const covXX = Math.max(0, sumXX / count - meanX * meanX);
  const covYY = Math.max(0, sumYY / count - meanY * meanY);
  const covXY = sumXY / count - meanX * meanY;

  return {
    count,
    mean: [meanX, meanY],
    covariance: [
      [covXX, covXY],
      [covXY, covYY],
    ],
    sumMagnitude,
  };
}

/**
 * Computes the kurtosis of the centred gradient vectors projected onto a direction
 *
 * @param plane - Luminance plane
 * @param stats - Gradient statistics for the same plane
 * @param direction - Unit vector to project onto
 * @returns Kurtosis (3 for a Gaussian); 0 if the projection has no variance
 */
export function projectionKurtosis(
  plane: LuminancePlane,
  stats: GradientStatistics,
  direction: number[]
): number {
  const { data: src, width, height } = plane;
  const [meanX, meanY] = stats.mean;
  const [dx, dy] = direction;

  let sum = 0;
  let sum2 = 0;
  let sum3 = 0;
  let sum4 = 0;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const p =
        (gradientX(src, width, x, i) - meanX) * dx +
        (gradientY(src, width, height, y, i) - meanY) * dy;
      const p2 = p * p;
      sum += p;
      sum2 += p2;
      sum3 += p2 * p;
      sum4 += p2 * p2;
    }
  }

  // Central moments from raw moments (the projection mean is ~0 but not exactly)
  const n = stats.count;
  const m1 = sum / n;
  const m2 = sum2 / n - m1 * m1;
  const m4 = sum4 / n - (4 * m1 * sum3) / n + 6 * m1 * m1 * (sum2 / n) - 3 * m1 ** 4;

  return m2 > 0 ? m4 / (m2 * m2) : 0;
}
