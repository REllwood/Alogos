import { LuminancePlane } from './analysis';
import { structureTensorCoherence } from './gradients';

/**
 * Gradient-field features used by the detector
 *
 * All features are computed from central-difference gradients of the
 * luminance plane at interior pixels. None of them depend on overall
 * brightness or contrast (each is a ratio, correlation or normalised moment),
 * so rescaling an image's brightness does not change them.
 */
export interface ImageFeatures {
  /**
   * Fraction of gradient variance along the first principal component (0.5-1).
   * 0.5 means gradients point equally in all directions; 1 means one direction dominates.
   */
  primaryVariance: number;
  /**
   * Natural log of the kurtosis of the gradients projected onto the first
   * principal component (log 3 ≈ 1.1 for Gaussian noise; photos are typically 2-4).
   */
  logKurtosis: number;
  /**
   * Log ratio of gradient energy at full resolution to gradient energy after
   * 2 × 2 averaging. Lower values mean less fine, pixel-level detail.
   */
  logFineToCoarse: number;
  /**
   * Log ratio of the energy left after subtracting a 3 × 3 local mean to the
   * gradient energy. Lower values mean smoother pixel-level texture.
   */
  logResidual: number;
  /**
   * Log ratio of mixed-derivative (checkerboard) energy to gradient energy.
   */
  logCross: number;
  /**
   * Correlation between neighbouring gradients along each axis (−1 to 1).
   * Higher values mean gradients change smoothly from pixel to pixel.
   */
  gradientCorrelation: number;
  /**
   * Mean orientation coherence of 8 × 8 blocks (0-1).
   */
  localCoherence: number;
}

/** Guard against log(0) and division by zero in energy ratios */
const EPSILON = 1e-12;

/**
 * Accumulates a Pearson correlation from paired samples
 */
class Correlation {
  private n = 0;
  private sa = 0;
  private sb = 0;
  private saa = 0;
  private sbb = 0;
  private sab = 0;

  add(a: number, b: number): void {
    this.n++;
    this.sa += a;
    this.sb += b;
    this.saa += a * a;
    this.sbb += b * b;
    this.sab += a * b;
  }

  value(): number {
    if (this.n === 0) return 0;
    const ma = this.sa / this.n;
    const mb = this.sb / this.n;
    const va = this.saa / this.n - ma * ma;
    const vb = this.sbb / this.n - mb * mb;
    const denominator = Math.sqrt(va * vb);
    return denominator > 0 ? (this.sab / this.n - ma * mb) / denominator : 0;
  }
}

/**
 * Computes the detector's gradient-field features for a luminance plane
 *
 * Runs in a few streaming passes over the plane; the gradient field is never
 * stored. Planes smaller than 3 × 3 have no interior gradients, and all
 * features are then neutral (0, or 0.5 for primaryVariance).
 *
 * @param plane - Luminance plane (values 0-255)
 * @returns Feature values
 */
export function extractFeatures(plane: LuminancePlane): ImageFeatures {
  const { data: L, width: W, height: H } = plane;

  // --- Pass 1: gradient moments, residual energy, neighbour correlations, block coherence ---
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let sumResidual = 0;

  const horizontal = new Correlation();
  const vertical = new Correlation();
  // gy at the previous row, for vertical neighbour pairs (NaN outside the interior)
  let previousGy = new Float64Array(W).fill(NaN);
  let currentGy = new Float64Array(W).fill(NaN);

  const blocksX = Math.floor(W / 8);
  const blocksY = Math.floor(H / 8);
  const jxx = new Float64Array(blocksX);
  const jyy = new Float64Array(blocksX);
  const jxy = new Float64Array(blocksX);
  let coherenceSum = 0;
  let coherenceCount = 0;

  for (let y = 0; y < H; y++) {
    const row = y * W;
    const interiorRow = y > 0 && y < H - 1;
    let previousGx = NaN;
    currentGy.fill(NaN);

    if (y % 8 === 0) {
      jxx.fill(0);
      jyy.fill(0);
      jxy.fill(0);
    }

    if (interiorRow) {
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;
        const gx = (L[i + 1] - L[i - 1]) / 2;
        const gy = (L[i + W] - L[i - W]) / 2;

        n++;
        sumX += gx;
        sumY += gy;
        sumXX += gx * gx;
        sumYY += gy * gy;
        sumXY += gx * gy;

        const localMean =
          (L[i - W - 1] +
            L[i - W] +
            L[i - W + 1] +
            L[i - 1] +
            L[i] +
            L[i + 1] +
            L[i + W - 1] +
            L[i + W] +
            L[i + W + 1]) /
          9;
        const residual = L[i] - localMean;
        sumResidual += residual * residual;

        if (!Number.isNaN(previousGx)) horizontal.add(previousGx, gx);
        previousGx = gx;

        if (!Number.isNaN(previousGy[x])) vertical.add(previousGy[x], gy);
        currentGy[x] = gy;

        const block = x >> 3;
        if (block < blocksX && y < blocksY * 8) {
          jxx[block] += gx * gx;
          jyy[block] += gy * gy;
          jxy[block] += gx * gy;
        }
      }
    }

    // Close a row of 8 × 8 blocks
    if (y % 8 === 7 && y < blocksY * 8) {
      for (let b = 0; b < blocksX; b++) {
        if (jxx[b] + jyy[b] > 1e-9) {
          coherenceSum += structureTensorCoherence(jxx[b], jyy[b], jxy[b]);
          coherenceCount++;
        }
      }
    }

    const swap = previousGy;
    previousGy = currentGy;
    currentGy = swap;
  }

  if (n === 0) {
    return {
      primaryVariance: 0.5,
      logKurtosis: 0,
      logFineToCoarse: 0,
      logResidual: 0,
      logCross: 0,
      gradientCorrelation: 0,
      localCoherence: 0,
    };
  }

  const meanX = sumX / n;
  const meanY = sumY / n;
  const covXX = sumXX / n - meanX * meanX;
  const covYY = sumYY / n - meanY * meanY;
  const covXY = sumXY / n - meanX * meanY;
  const trace = covXX + covYY;
  const half = Math.sqrt(((covXX - covYY) / 2) ** 2 + covXY * covXY);
  const lambda1 = trace / 2 + half;
  const primaryVariance = trace > 0 ? lambda1 / trace : 0.5;

  // Direction of the first principal component
  let dirX: number;
  let dirY: number;
  if (covXY !== 0) {
    const norm = Math.hypot(lambda1 - covYY, covXY);
    dirX = (lambda1 - covYY) / norm;
    dirY = covXY / norm;
  } else if (covXX >= covYY) {
    dirX = 1;
    dirY = 0;
  } else {
    dirX = 0;
    dirY = 1;
  }

  const gradientEnergy = (sumXX + sumYY) / n;

  // --- Pass 2: kurtosis of the projection onto the first principal component ---
  let m2 = 0;
  let m4 = 0;
  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      const p =
        ((L[i + 1] - L[i - 1]) / 2 - meanX) * dirX + ((L[i + W] - L[i - W]) / 2 - meanY) * dirY;
      const p2 = p * p;
      m2 += p2;
      m4 += p2 * p2;
    }
  }
  m2 /= n;
  m4 /= n;
  const logKurtosis = m2 > 0 ? Math.log(m4 / (m2 * m2)) : 0;

  // --- Pass 3: mixed-derivative energy on 2 × 2 cells ---
  let crossSum = 0;
  let crossCount = 0;
  for (let y = 0; y < H - 1; y++) {
    const row = y * W;
    for (let x = 0; x < W - 1; x++) {
      const i = row + x;
      const d = L[i] - L[i + 1] - L[i + W] + L[i + W + 1];
      crossSum += d * d;
      crossCount++;
    }
  }
  const crossEnergy = crossCount > 0 ? crossSum / crossCount : 0;

  // --- Pass 4: gradient energy after 2 × 2 averaging ---
  const W2 = Math.floor(W / 2);
  const H2 = Math.floor(H / 2);
  const pooled = new Float32Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      const i = 2 * y * W + 2 * x;
      pooled[y * W2 + x] = (L[i] + L[i + 1] + L[i + W] + L[i + W + 1]) / 4;
    }
  }
  let coarseSum = 0;
  let coarseCount = 0;
  for (let y = 1; y < H2 - 1; y++) {
    const row = y * W2;
    for (let x = 1; x < W2 - 1; x++) {
      const i = row + x;
      const gx = (pooled[i + 1] - pooled[i - 1]) / 2;
      const gy = (pooled[i + W2] - pooled[i - W2]) / 2;
      coarseSum += gx * gx + gy * gy;
      coarseCount++;
    }
  }
  const coarseEnergy = coarseCount > 0 ? coarseSum / coarseCount : 0;

  return {
    primaryVariance,
    logKurtosis,
    logFineToCoarse: Math.log((gradientEnergy + EPSILON) / (coarseEnergy + EPSILON)),
    logResidual: Math.log((sumResidual / n + EPSILON) / (gradientEnergy + EPSILON)),
    logCross: Math.log((crossEnergy + EPSILON) / (gradientEnergy + EPSILON)),
    gradientCorrelation: (horizontal.value() + vertical.value()) / 2,
    localCoherence: coherenceCount > 0 ? coherenceSum / coherenceCount : 0,
  };
}
