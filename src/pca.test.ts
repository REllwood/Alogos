import { computeCovarianceMatrix, performPCA, computePCAScore } from './pca';

describe('PCA Analysis', () => {
  describe('computeCovarianceMatrix', () => {
    it('should compute covariance for simple data', () => {
      const data = [
        [1, 2],
        [2, 4],
        [3, 6],
      ];

      const covariance = computeCovarianceMatrix(data);

      expect(covariance.length).toBe(2);
      expect(covariance[0].length).toBe(2);

      // Covariance matrix should be symmetric
      expect(covariance[0][1]).toBeCloseTo(covariance[1][0]);

      // Diagonal elements should be variances (positive)
      expect(covariance[0][0]).toBeGreaterThan(0);
      expect(covariance[1][1]).toBeGreaterThan(0);
    });

    it('should handle uniform data', () => {
      const data = [
        [5, 5],
        [5, 5],
        [5, 5],
      ];

      const covariance = computeCovarianceMatrix(data);

      // Covariance should be zero for uniform data
      covariance.forEach((row) => {
        row.forEach((value) => {
          expect(Math.abs(value)).toBeLessThan(1e-10);
        });
      });
    });

    it('should handle empty matrix', () => {
      const data: number[][] = [];
      const covariance = computeCovarianceMatrix(data);
      expect(covariance.length).toBe(0);
    });
  });

  describe('performPCA', () => {
    it('should compute principal components', () => {
      const data = [
        [2.5, 2.4],
        [0.5, 0.7],
        [2.2, 2.9],
        [1.9, 2.2],
        [3.1, 3.0],
        [2.3, 2.7],
        [2.0, 1.6],
        [1.0, 1.1],
        [1.5, 1.6],
        [1.1, 0.9],
      ];

      const result = performPCA(data, 2);

      expect(result.components.length).toBeGreaterThan(0);
      expect(result.explainedVariance.length).toBeGreaterThan(0);
      expect(result.projection.length).toBe(data.length);

      // First component should explain most variance
      expect(result.explainedVariance[0]).toBeGreaterThan(0);

      // Sum of explained variance should be close to 1
      const sumVariance = result.explainedVariance.reduce((a, b) => a + b, 0);
      expect(sumVariance).toBeCloseTo(1, 1);
    });

    it('should handle single component request', () => {
      const data = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      const result = performPCA(data, 1);

      expect(result.components.length).toBe(1);
      expect(result.explainedVariance.length).toBe(1);
    });

    it('should handle empty data', () => {
      const data: number[][] = [];
      const result = performPCA(data, 2);

      expect(result.components.length).toBe(0);
      expect(result.explainedVariance.length).toBe(0);
      expect(result.projection.length).toBe(0);
      expect(result.totalVariance).toBe(0);
    });
  });

  describe('computePCAScore', () => {
    it('should compute score from PCA result', () => {
      const pcaResult = {
        components: [[0.707, 0.707]],
        explainedVariance: [0.9],
        projection: [1, 2, 3, -1, -2, -3],
        totalVariance: 10,
      };

      const score = computePCAScore(pcaResult);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty PCA result', () => {
      const pcaResult = {
        components: [],
        explainedVariance: [],
        projection: [],
        totalVariance: 0,
      };

      const score = computePCAScore(pcaResult);
      expect(score).toBe(0);
    });

    it('should handle high variance concentration (real image)', () => {
      const pcaResult = {
        components: [[1, 0]],
        explainedVariance: [0.95, 0.05], // High concentration
        projection: [1, 1.1, 0.9, 1.2, 0.8], // Low kurtosis
        totalVariance: 10,
      };

      const score = computePCAScore(pcaResult);

      // Should indicate likely real (lower score)
      expect(score).toBeLessThan(0.5);
    });

    it('should handle low variance concentration (synthetic image)', () => {
      const pcaResult = {
        components: [[1, 0]],
        explainedVariance: [0.4, 0.3, 0.3], // Low concentration
        projection: [10, 1, 1, 1, -10, 1], // High kurtosis
        totalVariance: 10,
      };

      const score = computePCAScore(pcaResult);

      // Should indicate likely synthetic (higher score)
      expect(score).toBeGreaterThan(0.3);
    });
  });
});

