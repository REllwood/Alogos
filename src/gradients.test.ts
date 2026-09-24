import { computeGradients, flattenGradientField, computeGradientCoherence } from './gradients';

describe('Gradient Computation', () => {
  describe('computeGradients', () => {
    it('should compute gradients for a simple matrix', () => {
      const luminance = [
        [0, 1, 2],
        [0, 1, 2],
        [0, 1, 2],
      ];

      const gradients = computeGradients(luminance);

      expect(gradients.width).toBe(3);
      expect(gradients.height).toBe(3);
      expect(gradients.gx.length).toBe(3);
      expect(gradients.gy.length).toBe(3);

      // X-gradients should be approximately 1 in the interior
      expect(gradients.gx[1][1]).toBeCloseTo(1);

      // Y-gradients should be 0 (no vertical change)
      expect(gradients.gy[1][1]).toBeCloseTo(0);
    });

    it('should handle edge cases with forward/backward differences', () => {
      const luminance = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ];

      const gradients = computeGradients(luminance);

      // Top-left corner
      expect(gradients.gx[0][0]).toBe(1); // Forward difference
      expect(gradients.gy[0][0]).toBe(3); // Forward difference

      // Bottom-right corner
      expect(gradients.gx[2][2]).toBe(1); // Backward difference
      expect(gradients.gy[2][2]).toBe(3); // Backward difference
    });

    it('should handle a 1x1 matrix', () => {
      const luminance = [[5]];
      const gradients = computeGradients(luminance);

      expect(gradients.width).toBe(1);
      expect(gradients.height).toBe(1);
      expect(gradients.gx[0][0]).toBe(0);
      expect(gradients.gy[0][0]).toBe(0);
    });

    it('should handle an empty matrix', () => {
      const luminance: number[][] = [];
      const gradients = computeGradients(luminance);

      expect(gradients.width).toBe(0);
      expect(gradients.height).toBe(0);
      expect(gradients.gx.length).toBe(0);
      expect(gradients.gy.length).toBe(0);
    });
  });

  describe('flattenGradientField', () => {
    it('should flatten gradients into N×2 matrix', () => {
      const gradientField = {
        gx: [
          [1, 2],
          [3, 4],
        ],
        gy: [
          [5, 6],
          [7, 8],
        ],
        width: 2,
        height: 2,
      };

      const flattened = flattenGradientField(gradientField);

      expect(flattened.length).toBe(4); // 2x2 = 4 pixels
      expect(flattened[0]).toEqual([1, 5]);
      expect(flattened[1]).toEqual([2, 6]);
      expect(flattened[2]).toEqual([3, 7]);
      expect(flattened[3]).toEqual([4, 8]);
    });

    it('should handle empty gradient field', () => {
      const gradientField = {
        gx: [],
        gy: [],
        width: 0,
        height: 0,
      };

      const flattened = flattenGradientField(gradientField);
      expect(flattened.length).toBe(0);
    });
  });

  describe('computeGradientCoherence', () => {
    it('should return high coherence for aligned gradients', () => {
      const gradientField = {
        gx: [
          [1, 1],
          [1, 1],
        ],
        gy: [
          [0, 0],
          [0, 0],
        ],
        width: 2,
        height: 2,
      };

      const coherence = computeGradientCoherence(gradientField);
      expect(coherence).toBeCloseTo(1);
    });

    it('should return zero coherence for isotropic gradients', () => {
      const gradientField = {
        gx: [
          [1, 0],
          [-1, 0],
        ],
        gy: [
          [0, 1],
          [0, -1],
        ],
        width: 2,
        height: 2,
      };

      const coherence = computeGradientCoherence(gradientField);
      expect(coherence).toBeCloseTo(0, 12);
    });

    it('should treat opposite gradients as the same orientation', () => {
      // Both sides of a diagonal line: gradients point in opposite directions
      const gradientField = {
        gx: [
          [1, -1],
          [-1, 1],
        ],
        gy: [
          [1, -1],
          [-1, 1],
        ],
        width: 2,
        height: 2,
      };

      expect(computeGradientCoherence(gradientField)).toBeCloseTo(1, 12);
    });

    it('should average coherence over blocks', () => {
      // Left 2x2 block: all horizontal gradients (coherence 1)
      // Right 2x2 block: isotropic gradients (coherence 0)
      const gradientField = {
        gx: [
          [1, 1, 1, 0],
          [1, 1, -1, 0],
        ],
        gy: [
          [0, 0, 0, 1],
          [0, 0, 0, -1],
        ],
        width: 4,
        height: 2,
      };

      expect(computeGradientCoherence(gradientField, 2)).toBeCloseTo(0.5, 12);
    });

    it('should skip blocks without gradient energy', () => {
      const gradientField = {
        gx: [
          [1, 1, 0, 0],
          [1, 1, 0, 0],
        ],
        gy: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        width: 4,
        height: 2,
      };

      expect(computeGradientCoherence(gradientField, 2)).toBeCloseTo(1, 12);
    });

    it('should reject an invalid block size', () => {
      const gradientField = { gx: [[1]], gy: [[0]], width: 1, height: 1 };
      expect(() => computeGradientCoherence(gradientField, 0)).toThrow(RangeError);
    });

    it('should handle zero gradients', () => {
      const gradientField = {
        gx: [
          [0, 0],
          [0, 0],
        ],
        gy: [
          [0, 0],
          [0, 0],
        ],
        width: 2,
        height: 2,
      };

      const coherence = computeGradientCoherence(gradientField);
      expect(coherence).toBe(0);
    });
  });
});
