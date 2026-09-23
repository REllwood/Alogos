import { PCAResult } from './types';

/**
 * Computes the mean of each column in a matrix
 * 
 * @param matrix - Input matrix (rows × columns)
 * @returns Array of column means
 */
function computeMean(matrix: number[][]): number[] {
  if (matrix.length === 0) return [];
  
  const numRows = matrix.length;
  const numCols = matrix[0].length;
  const means: number[] = new Array(numCols).fill(0);

  for (let j = 0; j < numCols; j++) {
    let sum = 0;
    for (let i = 0; i < numRows; i++) {
      sum += matrix[i][j];
    }
    means[j] = sum / numRows;
  }

  return means;
}

/**
 * Centres a matrix by subtracting the mean of each column
 * 
 * @param matrix - Input matrix
 * @returns Centred matrix
 */
function centreMatrix(matrix: number[][]): number[][] {
  const means = computeMean(matrix);
  return matrix.map(row =>
    row.map((value, colIdx) => value - means[colIdx])
  );
}

/**
 * Computes the covariance matrix of data that has already been centred
 *
 * @param centred - Centred data matrix (N rows × D columns)
 * @returns Covariance matrix (D × D)
 */
function covarianceOfCentred(centred: number[][]): number[][] {
  const numRows = centred.length;
  const numCols = centred[0].length;

  // Compute M^T * M / N (the matrix is symmetric, so fill both halves at once)
  const covariance: number[][] = Array.from({ length: numCols }, () => new Array(numCols).fill(0));
  for (let i = 0; i < numCols; i++) {
    for (let j = i; j < numCols; j++) {
      let sum = 0;
      for (let k = 0; k < numRows; k++) {
        sum += centred[k][i] * centred[k][j];
      }
      covariance[i][j] = sum / numRows;
      covariance[j][i] = covariance[i][j];
    }
  }

  return covariance;
}

/**
 * Computes the covariance matrix of a data matrix
 * Covariance matrix C = (1/N) * M^T * M
 * where M is the centred data matrix
 *
 * @param matrix - Input matrix (N rows × D columns)
 * @returns Covariance matrix (D × D)
 */
export function computeCovarianceMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  return covarianceOfCentred(centreMatrix(matrix));
}

/**
 * Computes all eigenvalues and eigenvectors of a symmetric matrix using the
 * cyclic Jacobi method
 *
 * The method is deterministic and accurate to machine precision for the small
 * matrices used here (a 2 × 2 matrix is solved exactly by a single rotation).
 * Eigenvalues are returned in descending order. Each eigenvector's sign is
 * fixed so that its largest-magnitude entry is positive, which keeps results
 * reproducible between runs.
 *
 * @param matrix - Symmetric matrix (D × D)
 * @returns Eigenvalues (descending) and matching unit eigenvectors
 */
export function computeEigenDecomposition(matrix: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = matrix.length;
  if (n === 0) return { eigenvalues: [], eigenvectors: [] };

  const a = matrix.map((row) => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) total += a[i][j] * a[i][j];
  }

  const maxSweeps = 50;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let offDiagonal = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) offDiagonal += a[p][q] * a[p][q];
    }
    if (offDiagonal <= 1e-30 * total) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (a[p][q] === 0) continue;

        // Rotation angle that zeroes a[p][q]
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);

  const eigenvalues = order.map((i) => a[i][i]);
  const eigenvectors = order.map((col) => {
    const vector = v.map((row) => row[col]);
    let largest = 0;
    for (let k = 1; k < n; k++) {
      if (Math.abs(vector[k]) > Math.abs(vector[largest])) largest = k;
    }
    return vector[largest] < 0 ? vector.map((x) => -x) : vector;
  });

  return { eigenvalues, eigenvectors };
}

/**
 * Performs Principal Component Analysis on a data matrix
 *
 * The analysis is exact and deterministic: repeated calls on the same data
 * return identical results.
 *
 * @param data - Input data matrix (N rows × D columns)
 * @param numComponents - Number of principal components to return (a positive
 *   integer; values larger than D are capped at D)
 * @returns PCA result with components, explained variance ratios (relative to
 *   the total variance of the data), and the projection onto the first component
 * @throws RangeError if numComponents is not a positive integer
 */
export function performPCA(data: number[][], numComponents: number = 5): PCAResult {
  if (!Number.isInteger(numComponents) || numComponents < 1) {
    throw new RangeError(`numComponents must be a positive integer, got ${numComponents}`);
  }

  if (data.length === 0 || data[0].length === 0) {
    return {
      components: [],
      explainedVariance: [],
      projection: [],
      totalVariance: 0,
    };
  }

  // Centre the data once and derive the covariance matrix from it
  const centred = centreMatrix(data);
  const covariance = covarianceOfCentred(centred);

  // Full eigendecomposition (D is small), then keep the leading components
  const decomposition = computeEigenDecomposition(covariance);
  const k = Math.min(numComponents, covariance.length);
  // Round-off can leave tiny negative eigenvalues; variance cannot be negative
  const eigenvalues = decomposition.eigenvalues.slice(0, k).map((val) => Math.max(0, val));
  const eigenvectors = decomposition.eigenvectors.slice(0, k);

  // Total variance of the data is the trace of the covariance matrix
  const totalVariance = covariance.reduce((sum, row, i) => sum + row[i], 0);

  // Explained variance ratio of each returned component
  const explainedVariance = eigenvalues.map((val) =>
    totalVariance > 0 ? val / totalVariance : 0
  );

  // Project data onto first principal component for analysis
  const projection: number[] = [];
  const firstComponent = eigenvectors[0];
  for (let i = 0; i < centred.length; i++) {
    let proj = 0;
    for (let j = 0; j < centred[i].length; j++) {
      proj += centred[i][j] * firstComponent[j];
    }
    projection.push(proj);
  }

  return {
    components: eigenvectors,
    explainedVariance,
    projection,
    totalVariance,
  };
}

/**
 * Computes statistical properties of the PCA projection
 * Used to distinguish between real and synthetic images
 * 
 * @param pcaResult - Result from PCA analysis
 * @returns Statistical score (higher values indicate more likely synthetic)
 */
export function computePCAScore(pcaResult: PCAResult): number {
  const { explainedVariance, projection } = pcaResult;

  if (explainedVariance.length === 0 || projection.length === 0) {
    return 0;
  }

  // Compute projection statistics
  const mean = projection.reduce((sum, val) => sum + val, 0) / projection.length;
  const variance = projection.reduce((sum, val) =>
    sum + (val - mean) * (val - mean), 0
  ) / projection.length;
  const stdDev = Math.sqrt(variance);

  // Compute kurtosis (measure of tail heaviness)
  let kurtosis = 0;
  if (stdDev > 0) {
    const fourthMoment = projection.reduce((sum, val) => {
      const normalised = (val - mean) / stdDev;
      return sum + normalised * normalised * normalised * normalised;
    }, 0) / projection.length;
    kurtosis = fourthMoment;
  }

  return combinePCAScore(explainedVariance[0], kurtosis);
}

/**
 * Combines the primary variance ratio and projection kurtosis into a score
 *
 * @param primaryVariance - Fraction of variance explained by the first component
 * @param kurtosis - Kurtosis of the projection onto the first component (0 if undefined)
 * @returns Score between 0 and 1 (higher values indicate more likely synthetic)
 */
export function combinePCAScore(primaryVariance: number, kurtosis: number): number {
  // Excess kurtosis (0 for a Gaussian); a projection with no variance contributes nothing
  const excessKurtosis = kurtosis > 0 ? kurtosis - 3 : 0;

  // Combine metrics into a score
  // Synthetic images typically show:
  // - Lower primary variance concentration (more dispersed)
  // - Higher kurtosis (heavier tails)
  const score = (1 - primaryVariance) * 0.6 + Math.max(0, excessKurtosis) * 0.4;

  return Math.max(0, Math.min(1, score));
}
