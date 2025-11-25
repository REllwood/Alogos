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
 * Computes the covariance matrix of a data matrix
 * Covariance matrix C = (1/N) * M^T * M
 * where M is the centred data matrix
 * 
 * @param matrix - Input matrix (N rows × D columns)
 * @returns Covariance matrix (D × D)
 */
export function computeCovarianceMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  
  const centred = centreMatrix(matrix);
  const numRows = centred.length;
  const numCols = centred[0].length;

  // Compute M^T * M
  const covariance: number[][] = [];
  for (let i = 0; i < numCols; i++) {
    const row: number[] = [];
    for (let j = 0; j < numCols; j++) {
      let sum = 0;
      for (let k = 0; k < numRows; k++) {
        sum += centred[k][i] * centred[k][j];
      }
      row.push(sum / numRows);
    }
    covariance.push(row);
  }

  return covariance;
}

/**
 * Computes eigenvalues and eigenvectors using the power iteration method
 * This is a simplified implementation suitable for small matrices
 * 
 * @param matrix - Symmetric matrix
 * @param numComponents - Number of components to compute
 * @returns Eigenvalues and eigenvectors
 */
function computeEigenDecomposition(
  matrix: number[][],
  numComponents: number
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  if (n === 0) return { eigenvalues: [], eigenvectors: [] };

  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  // Work on a copy of the matrix for deflation
  const workMatrix = matrix.map(row => [...row]);

  for (let comp = 0; comp < Math.min(numComponents, n); comp++) {
    // Initialise random vector
    let vector = new Array(n).fill(0).map(() => Math.random() - 0.5);
    
    // Normalise
    let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    vector = vector.map(v => v / norm);

    // Power iteration
    const maxIterations = 100;
    const tolerance = 1e-6;
    let eigenvalue = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Multiply matrix by vector
      const newVector = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVector[i] += workMatrix[i][j] * vector[j];
        }
      }

      // Compute eigenvalue (Rayleigh quotient)
      eigenvalue = 0;
      for (let i = 0; i < n; i++) {
        eigenvalue += vector[i] * newVector[i];
      }

      // Normalise new vector
      norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      
      const normalisedVector = newVector.map(v => v / norm);

      // Check convergence
      const diff = vector.reduce((sum, v, i) => 
        sum + Math.abs(v - normalisedVector[i]), 0
      );
      
      vector = normalisedVector;
      
      if (diff < tolerance) break;
    }

    eigenvalues.push(eigenvalue);
    eigenvectors.push(vector);

    // Deflate the matrix (remove this component)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        workMatrix[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }

  return { eigenvalues, eigenvectors };
}

/**
 * Performs Principal Component Analysis on a data matrix
 * 
 * @param data - Input data matrix (N rows × D columns)
 * @param numComponents - Number of principal components to compute
 * @returns PCA result with components, variance, and projection
 */
export function performPCA(data: number[][], numComponents: number = 5): PCAResult {
  if (data.length === 0) {
    return {
      components: [],
      explainedVariance: [],
      projection: [],
      totalVariance: 0,
    };
  }

  // Centre the data
  const centred = centreMatrix(data);

  // Compute covariance matrix
  const covariance = computeCovarianceMatrix(data);

  // Compute eigendecomposition
  const { eigenvalues, eigenvectors } = computeEigenDecomposition(
    covariance,
    numComponents
  );

  // Compute total variance
  const totalVariance = eigenvalues.reduce((sum, val) => sum + Math.abs(val), 0);

  // Compute explained variance ratios
  const explainedVariance = eigenvalues.map(val => 
    totalVariance > 0 ? Math.abs(val) / totalVariance : 0
  );

  // Project data onto first principal component for analysis
  const projection: number[] = [];
  if (eigenvectors.length > 0) {
    const firstComponent = eigenvectors[0];
    for (let i = 0; i < centred.length; i++) {
      let proj = 0;
      for (let j = 0; j < centred[i].length; j++) {
        proj += centred[i][j] * firstComponent[j];
      }
      projection.push(proj);
    }
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

  // Primary variance: Higher concentration in first component suggests
  // more structured (real) or chaotic (synthetic) patterns
  const primaryVariance = explainedVariance[0];

  // Compute projection statistics
  const mean = projection.reduce((sum, val) => sum + val, 0) / projection.length;
  const variance = projection.reduce((sum, val) => 
    sum + (val - mean) * (val - mean), 0
  ) / projection.length;
  const stdDev = Math.sqrt(variance);

  // Compute kurtosis (measure of tail heaviness)
  // Synthetic images often show higher kurtosis due to unstable gradients
  let kurtosis = 0;
  if (stdDev > 0) {
    const fourthMoment = projection.reduce((sum, val) => {
      const normalised = (val - mean) / stdDev;
      return sum + normalised * normalised * normalised * normalised;
    }, 0) / projection.length;
    kurtosis = fourthMoment - 3; // Excess kurtosis
  }

  // Combine metrics into a score
  // Synthetic images typically show:
  // - Lower primary variance concentration (more dispersed)
  // - Higher kurtosis (heavier tails)
  const score = (1 - primaryVariance) * 0.6 + Math.max(0, kurtosis) * 0.4;

  return Math.max(0, Math.min(1, score));
}

