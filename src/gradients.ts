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
 * Computes the coherence of a gradient field
 * Measures how aligned/consistent the gradients are
 * 
 * Higher coherence indicates more structured gradients (typical of real images)
 * Lower coherence indicates chaotic gradients (typical of synthetic images)
 * 
 * @param gradientField - Gradient field to analyse
 * @returns Coherence value (0-1, higher is more coherent)
 */
export function computeGradientCoherence(gradientField: GradientField): number {
  const { gx, gy, width, height } = gradientField;
  
  if (width === 0 || height === 0) return 0;

  let sumMagnitude = 0;
  let sumXComponent = 0;
  let sumYComponent = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = gx[y][x];
      const dy = gy[y][x];
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      
      sumMagnitude += magnitude;
      sumXComponent += dx;
      sumYComponent += dy;
    }
  }

  if (sumMagnitude === 0) return 0;

  // Coherence is the ratio of the vector sum to the scalar sum
  const vectorSum = Math.sqrt(sumXComponent * sumXComponent + sumYComponent * sumYComponent);
  return vectorSum / sumMagnitude;
}

