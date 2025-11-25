import { rgbToLuminance, imageToluminanceMatrix, normaliseLuminance } from './luminance';
import { ImageData } from './types';

describe('Luminance Conversion', () => {
  describe('rgbToLuminance', () => {
    it('should convert pure red to correct luminance', () => {
      const luminance = rgbToLuminance(255, 0, 0);
      expect(luminance).toBeCloseTo(0.2126 * 255);
    });

    it('should convert pure green to correct luminance', () => {
      const luminance = rgbToLuminance(0, 255, 0);
      expect(luminance).toBeCloseTo(0.7152 * 255);
    });

    it('should convert pure blue to correct luminance', () => {
      const luminance = rgbToLuminance(0, 0, 255);
      expect(luminance).toBeCloseTo(0.0722 * 255);
    });

    it('should convert white to maximum luminance', () => {
      const luminance = rgbToLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(255);
    });

    it('should convert black to minimum luminance', () => {
      const luminance = rgbToLuminance(0, 0, 0);
      expect(luminance).toBe(0);
    });

    it('should handle mid-tone grey correctly', () => {
      const luminance = rgbToLuminance(128, 128, 128);
      expect(luminance).toBeCloseTo(128);
    });
  });

  describe('imageToluminanceMatrix', () => {
    it('should convert a simple 2x2 image', () => {
      const imageData: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          255, 0, 0, 255, // Red pixel
          0, 255, 0, 255, // Green pixel
          0, 0, 255, 255, // Blue pixel
          255, 255, 255, 255, // White pixel
        ]),
      };

      const matrix = imageToluminanceMatrix(imageData);

      expect(matrix.length).toBe(2);
      expect(matrix[0].length).toBe(2);
      expect(matrix[0][0]).toBeCloseTo(0.2126 * 255);
      expect(matrix[0][1]).toBeCloseTo(0.7152 * 255);
      expect(matrix[1][0]).toBeCloseTo(0.0722 * 255);
      expect(matrix[1][1]).toBeCloseTo(255);
    });

    it('should handle an empty image', () => {
      const imageData: ImageData = {
        width: 0,
        height: 0,
        data: new Uint8ClampedArray([]),
      };

      const matrix = imageToluminanceMatrix(imageData);
      expect(matrix.length).toBe(0);
    });

    it('should ignore alpha channel', () => {
      const imageData: ImageData = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([128, 128, 128, 0]), // Transparent grey
      };

      const matrix = imageToluminanceMatrix(imageData);
      expect(matrix[0][0]).toBeCloseTo(128);
    });
  });

  describe('normaliseLuminance', () => {
    it('should normalise values to [0, 1] range', () => {
      const matrix = [
        [0, 128, 255],
        [64, 192, 128],
      ];

      const normalised = normaliseLuminance(matrix);

      // Check all values are in [0, 1]
      normalised.forEach((row) => {
        row.forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        });
      });

      // Check min and max
      expect(normalised[0][0]).toBe(0); // Min value
      expect(normalised[0][2]).toBe(1); // Max value
    });

    it('should handle uniform values', () => {
      const matrix = [
        [128, 128],
        [128, 128],
      ];

      const normalised = normaliseLuminance(matrix);

      // All values should be 0 when uniform
      normalised.forEach((row) => {
        row.forEach((value) => {
          expect(value).toBe(0);
        });
      });
    });

    it('should handle empty matrix', () => {
      const matrix: number[][] = [];
      const normalised = normaliseLuminance(matrix);
      expect(normalised.length).toBe(0);
    });
  });
});

