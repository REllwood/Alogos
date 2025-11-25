import { SyntheticImageDetector, detectSyntheticImage } from './detector';
import { ImageData } from './types';

describe('SyntheticImageDetector', () => {
  // Helper to create test image data
  function createTestImage(width: number, height: number, pattern: 'uniform' | 'gradient' | 'checkerboard'): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let value = 0;

        switch (pattern) {
          case 'uniform':
            value = 128;
            break;
          case 'gradient':
            value = Math.floor((x / width) * 255);
            break;
          case 'checkerboard':
            value = (x + y) % 2 === 0 ? 255 : 0;
            break;
        }

        data[idx] = value; // R
        data[idx + 1] = value; // G
        data[idx + 2] = value; // B
        data[idx + 3] = 255; // A
      }
    }

    return { width, height, data };
  }

  describe('constructor', () => {
    it('should create detector with default options', () => {
      const detector = new SyntheticImageDetector();
      const options = detector.getOptions();

      expect(options.threshold).toBe(0.5);
      expect(options.numComponents).toBe(5);
      expect(options.normaliseGradients).toBe(true);
      expect(options.minImageSize).toBe(64);
    });

    it('should create detector with custom options', () => {
      const detector = new SyntheticImageDetector({
        threshold: 0.7,
        numComponents: 3,
      });
      const options = detector.getOptions();

      expect(options.threshold).toBe(0.7);
      expect(options.numComponents).toBe(3);
    });
  });

  describe('analyse', () => {
    it('should analyse a valid image', () => {
      const detector = new SyntheticImageDetector();
      const imageData = createTestImage(100, 100, 'gradient');

      const result = detector.analyse(imageData);

      expect(result).toHaveProperty('isSynthetic');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rawScore');
      expect(result).toHaveProperty('metadata');

      expect(typeof result.isSynthetic).toBe('boolean');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.rawScore).toBeGreaterThanOrEqual(0);
      expect(result.rawScore).toBeLessThanOrEqual(1);
    });

    it('should include correct metadata', () => {
      const detector = new SyntheticImageDetector();
      const imageData = createTestImage(100, 100, 'gradient');

      const result = detector.analyse(imageData);

      expect(result.metadata.pixelsAnalysed).toBe(10000);
      expect(result.metadata.primaryVariance).toBeGreaterThanOrEqual(0);
      expect(result.metadata.primaryVariance).toBeLessThanOrEqual(1);
      expect(result.metadata.coherence).toBeGreaterThanOrEqual(0);
      expect(result.metadata.coherence).toBeLessThanOrEqual(1);
    });

    it('should throw error for image smaller than minimum size', () => {
      const detector = new SyntheticImageDetector({ minImageSize: 64 });
      const imageData = createTestImage(32, 32, 'gradient');

      expect(() => detector.analyse(imageData)).toThrow('Image too small');
    });

    it('should throw error for invalid image data', () => {
      const detector = new SyntheticImageDetector();

      expect(() =>
        detector.analyse({
          width: 0,
          height: 0,
          data: new Uint8ClampedArray([]),
        })
      ).toThrow('Invalid image dimensions');
    });

    it('should throw error for mismatched data length', () => {
      const detector = new SyntheticImageDetector();

      expect(() =>
        detector.analyse({
          width: 10,
          height: 10,
          data: new Uint8ClampedArray(100), // Should be 400
        })
      ).toThrow('Image data length mismatch');
    });

    it('should handle different image patterns', () => {
      const detector = new SyntheticImageDetector();

      const uniform = createTestImage(100, 100, 'uniform');
      const gradient = createTestImage(100, 100, 'gradient');
      const checkerboard = createTestImage(100, 100, 'checkerboard');

      const result1 = detector.analyse(uniform);
      const result2 = detector.analyse(gradient);
      const result3 = detector.analyse(checkerboard);

      // All should return valid results
      expect(result1.rawScore).toBeGreaterThanOrEqual(0);
      expect(result2.rawScore).toBeGreaterThanOrEqual(0);
      expect(result3.rawScore).toBeGreaterThanOrEqual(0);

      // Results should be bounded [0, 1]
      expect(result1.rawScore).toBeLessThanOrEqual(1);
      expect(result2.rawScore).toBeLessThanOrEqual(1);
      expect(result3.rawScore).toBeLessThanOrEqual(1);
    });
  });

  describe('analyseGradients', () => {
    it('should return gradient field', () => {
      const detector = new SyntheticImageDetector();
      const imageData = createTestImage(100, 100, 'gradient');

      const gradientField = detector.analyseGradients(imageData);

      expect(gradientField).toHaveProperty('gx');
      expect(gradientField).toHaveProperty('gy');
      expect(gradientField).toHaveProperty('width');
      expect(gradientField).toHaveProperty('height');

      expect(gradientField.width).toBe(100);
      expect(gradientField.height).toBe(100);
      expect(gradientField.gx.length).toBe(100);
      expect(gradientField.gy.length).toBe(100);
    });
  });

  describe('setOptions', () => {
    it('should update options', () => {
      const detector = new SyntheticImageDetector({ threshold: 0.5 });
      
      detector.setOptions({ threshold: 0.8 });
      
      const options = detector.getOptions();
      expect(options.threshold).toBe(0.8);
    });

    it('should merge with existing options', () => {
      const detector = new SyntheticImageDetector({
        threshold: 0.5,
        numComponents: 5,
      });
      
      detector.setOptions({ threshold: 0.8 });
      
      const options = detector.getOptions();
      expect(options.threshold).toBe(0.8);
      expect(options.numComponents).toBe(5); // Should remain unchanged
    });
  });

  describe('detectSyntheticImage convenience function', () => {
    it('should work with default options', () => {
      const imageData = createTestImage(100, 100, 'gradient');
      const result = detectSyntheticImage(imageData);

      expect(result).toHaveProperty('isSynthetic');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rawScore');
    });

    it('should work with custom options', () => {
      const imageData = createTestImage(100, 100, 'gradient');
      const result = detectSyntheticImage(imageData, { threshold: 0.7 });

      expect(result).toHaveProperty('isSynthetic');
      expect(result).toHaveProperty('confidence');
    });
  });
});

