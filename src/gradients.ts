import { GradientField } from './types';

/**
 * Computes spatial gradients of a luminance matrix using central differences
 * 
 * For interior points, uses central differences:
 * Gx(x,y) = (L(x+1,y) - L(x-1,y)) / 2
 * Gy(x,y) = (L(x,y+1) - L(x,y-1)) / 2
 * 
 * For edge points, uses forward/backward differences
 * 
 * @param luminanceMatrix - 2D array of luminance values
 * @returns Gradient field with x and y components
 */
export function computeGradients(luminanceMatrix: number[][]): GradientField {
  const height = luminanceMatrix.length;
  if (height === 0) {
    return { gx: [], gy: [], width: 0, height: 0 };
  }

  const width = luminanceMatrix[0].length;
  if (width === 0) {
    return { gx: [], gy: [], width: 0, height: 0 };
  }

  const gx: number[][] = [];
  const gy: number[][] = [];

  for (let y = 0; y < height; y++) {
    const gxRow: number[] = [];
    const gyRow: number[] = [];

    for (let x = 0; x < width; x++) {
      // Compute x-gradient (horizontal)
      let gradX: number;
      if (x === 0 && width > 1) {
        // Forward difference at left edge
        gradX = luminanceMatrix[y][x + 1] - luminanceMatrix[y][x];
      } else if (x === width - 1 && width > 1) {
        // Backward difference at right edge
        gradX = luminanceMatrix[y][x] - luminanceMatrix[y][x - 1];
      } else if (width === 1) {
        // Single column, no horizontal gradient
        gradX = 0;
      } else {
        // Central difference for interior points
        gradX = (luminanceMatrix[y][x + 1] - luminanceMatrix[y][x - 1]) / 2;
      }

      // Compute y-gradient (vertical)
      let gradY: number;
      if (y === 0 && height > 1) {
        // Forward difference at top edge
        gradY = luminanceMatrix[y + 1][x] - luminanceMatrix[y][x];
      } else if (y === height - 1 && height > 1) {
        // Backward difference at bottom edge
        gradY = luminanceMatrix[y][x] - luminanceMatrix[y - 1][x];
      } else if (height === 1) {
        // Single row, no vertical gradient
        gradY = 0;
      } else {
        // Central difference for interior points
        gradY = (luminanceMatrix[y + 1][x] - luminanceMatrix[y - 1][x]) / 2;
      }

      gxRow.push(gradX);
      gyRow.push(gradY);
    }

    gx.push(gxRow);
    gy.push(gyRow);
  }

  return { gx, gy, width, height };
}

/**
 * Flattens a gradient field into a matrix where each row is a pixel
 * and columns are [Gx, Gy] for that pixel
 * 
 * Result is an N×2 matrix where N = width × height
 * 
 * @param gradientField - Gradient field to flatten
 * @returns Flattened matrix (N×2)
 */
export function flattenGradientField(gradientField: GradientField): number[][] {
  const { gx, gy, width, height } = gradientField;
  const matrix: number[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      matrix.push([gx[y][x], gy[y][x]]);
    }
  }

  return matrix;
}

/**
 * Computes the orientation coherence of 2 × 2 structure-tensor sums
 *
 * @param jxx - Sum of gx²
 * @param jyy - Sum of gy²
 * @param jxy - Sum of gx·gy
 * @returns (λ1 − λ2) / (λ1 + λ2) of the structure tensor, or NaN if it has no energy
 */
export function structureTensorCoherence(jxx: number, jyy: number, jxy: number): number {
  const trace = jxx + jyy;
  if (!(trace > 0)) return NaN;
  return Math.min(1, Math.sqrt((jxx - jyy) * (jxx - jyy) + 4 * jxy * jxy) / trace);
}

/**
 * Computes the average local orientation coherence of a gradient field
 *
 * The field is divided into non-overlapping square blocks (8 × 8 by default,
 * aligned with the top-left corner; a field smaller than one block is treated
 * as a single block). For each block the structure tensor
 * J = Σ [gx², gx·gy; gx·gy, gy²] is formed and its coherence
 * (λ1 − λ2) / (λ1 + λ2) measured: 1 when every gradient in the block shares
 * one orientation (a clean edge or line), 0 when orientations are spread
 * evenly (noise or isotropic texture). Opposite gradients (both sides of a
 * line) count as the same orientation. Blocks with no gradient energy are
 * skipped.
 *
 * @param gradientField - Gradient field to analyse
 * @param blockSize - Block side length in pixels (default 8)
 * @returns Mean block coherence (0-1); 0 if the field has no gradient energy
 */
export function computeGradientCoherence(gradientField: GradientField, blockSize = 8): number {
  const { gx, gy, width, height } = gradientField;

  if (width === 0 || height === 0) return 0;
  if (!Number.isInteger(blockSize) || blockSize < 1) {
    throw new RangeError(`blockSize must be a positive integer, got ${blockSize}`);
  }

  const size = Math.min(blockSize, width, height);
  const blocksX = Math.floor(width / size);
  const blocksY = Math.floor(height / size);

  let sum = 0;
  let count = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let jxx = 0;
      let jyy = 0;
      let jxy = 0;
      for (let y = by * size; y < (by + 1) * size; y++) {
        for (let x = bx * size; x < (bx + 1) * size; x++) {
          const dx = gx[y][x];
          const dy = gy[y][x];
          jxx += dx * dx;
          jyy += dy * dy;
          jxy += dx * dy;
        }
      }
      const coherence = structureTensorCoherence(jxx, jyy, jxy);
      if (!Number.isNaN(coherence)) {
        sum += coherence;
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 0;
}
