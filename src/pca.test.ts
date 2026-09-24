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

    it('should find the exact direction of perfectly correlated data', () => {
      const data = [-2, -1, 0, 1, 2].map((t) => [t, 2 * t]);
      const result = performPCA(data, 2);

      expect(result.explainedVariance[0]).toBeCloseTo(1, 12);
      expect(result.explainedVariance[1]).toBeCloseTo(0, 12);
      expect(result.components[0][0]).toBeCloseTo(1 / Math.sqrt(5), 12);
      expect(result.components[0][1]).toBeCloseTo(2 / Math.sqrt(5), 12);
    });

    it('should recover known eigenvalues of rotated 3-D data', () => {
      // Axis-aligned data with covariance diag(3, 4/3, 1/3), then rotated
      const axisAligned = [
        [3, 0, 0],
        [-3, 0, 0],
        [0, 2, 0],
        [0, -2, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
      const c = Math.cos(0.7);
      const s = Math.sin(0.7);
      const rotation = [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1],
      ];
      const data = axisAligned.map((row) =>
        rotation.map((r) => r[0] * row[0] + r[1] * row[1] + r[2] * row[2])
      );

      const result = performPCA(data, 3);
      const total = 3 + 4 / 3 + 1 / 3;

      expect(result.totalVariance).toBeCloseTo(total, 12);
      expect(result.explainedVariance[0]).toBeCloseTo(3 / total, 12);
      expect(result.explainedVariance[1]).toBeCloseTo(4 / 3 / total, 12);
      expect(result.explainedVariance[2]).toBeCloseTo(1 / 3 / total, 12);

      // Each component must satisfy C v = λ v and have unit length
      const covariance = computeCovarianceMatrix(data);
      result.components.forEach((v, i) => {
        const lambda = result.explainedVariance[i] * result.totalVariance;
        covariance.forEach((row, r) => {
          const cv = row[0] * v[0] + row[1] * v[1] + row[2] * v[2];
          expect(cv).toBeCloseTo(lambda * v[r], 12);
        });
        expect(Math.hypot(...v)).toBeCloseTo(1, 12);
      });
    });

    it('should be deterministic', () => {
      const data = Array.from({ length: 200 }, (_, i) => [Math.sin(i * 1.3), Math.cos(i * 0.7)]);

      const first = performPCA(data, 2);
      for (let run = 0; run < 10; run++) {
        expect(performPCA(data, 2)).toEqual(first);
      }
    });

    it('should never report a primary variance below 0.5 for 2-D data', () => {
      // Isotropic data: both eigenvalues are equal
      const data = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];

      const result = performPCA(data, 2);

      expect(result.explainedVariance[0]).toBeCloseTo(0.5, 12);
      expect(result.explainedVariance[1]).toBeCloseTo(0.5, 12);
    });

    it('should report explained variance relative to the total, even for one component', () => {
      const data = [
        [2, 0],
        [-2, 0],
        [0, 1],
        [0, -1],
      ];

      const result = performPCA(data, 1);

      expect(result.components.length).toBe(1);
      expect(result.explainedVariance[0]).toBeCloseTo(0.8, 12);
    });

    it('should cap the number of components at the data dimension', () => {
      const data = [
        [1, 2],
        [3, 1],
        [0, 5],
      ];

      const result = performPCA(data, 10);

      expect(result.components.length).toBe(2);
      expect(result.explainedVariance.length).toBe(2);
    });

    it('should reject an invalid number of components', () => {
      const data = [
        [1, 2],
        [3, 4],
      ];

      expect(() => performPCA(data, 0)).toThrow(RangeError);
      expect(() => performPCA(data, -1)).toThrow(RangeError);
      expect(() => performPCA(data, 1.5)).toThrow(RangeError);
      expect(() => performPCA(data, NaN)).toThrow(RangeError);
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
