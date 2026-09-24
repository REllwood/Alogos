import { SyntheticImageDetector, detectSyntheticImage } from './detector';
import { ImageData } from './types';
import { computeConfidence } from './confidence';

describe('SyntheticImageDetector', () => {
  // Helper to create test image data
  function createTestImage(
    width: number,
    height: number,
    pattern: 'uniform' | 'gradient' | 'checkerboard'
  ): ImageData {
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

    it('should use defaults for options passed as undefined', () => {
      const detector = new SyntheticImageDetector({ threshold: undefined });
      expect(detector.getOptions().threshold).toBe(0.5);
    });

    it.each([0, 1, -0.2, 1.5, NaN, Infinity])('should reject threshold %p', (threshold) => {
      expect(() => new SyntheticImageDetector({ threshold })).toThrow(RangeError);
    });

    it.each([0, -1, 2.5, NaN])('should reject numComponents %p', (numComponents) => {
      expect(() => new SyntheticImageDetector({ numComponents })).toThrow(RangeError);
    });

    it.each([0, 2, 10.5, NaN])('should reject minImageSize %p', (minImageSize) => {
      expect(() => new SyntheticImageDetector({ minImageSize })).toThrow(RangeError);
    });

    it('should reject non-boolean flags', () => {
      expect(
        () => new SyntheticImageDetector({ normaliseGradients: 'yes' as unknown as boolean })
      ).toThrow(TypeError);
      expect(
        () => new SyntheticImageDetector({ filterCompressionArtifacts: 1 as unknown as boolean })
      ).toThrow(TypeError);
    });
  });

  describe('confidence', () => {
    it('should match the confidence formula for every threshold', () => {
      const image = createTestImage(100, 100, 'checkerboard');
      const rawScore = new SyntheticImageDetector().analyse(image).rawScore;

      for (const threshold of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const result = new SyntheticImageDetector({ threshold }).analyse(image);

        expect(result.rawScore).toBe(rawScore);
        expect(result.isSynthetic).toBe(rawScore >= threshold);
        expect(result.confidence).toBe(computeConfidence(rawScore, threshold));
      }
    });
  });

  describe('analyse', () => {
    it('should be deterministic', () => {
      const detector = new SyntheticImageDetector();
      const imageData = createTestImage(100, 100, 'checkerboard');
      expect(detector.analyse(imageData)).toEqual(detector.analyse(imageData));
    });

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

    it('should throw error for non-integer dimensions', () => {
      const detector = new SyntheticImageDetector();

      expect(() =>
        detector.analyse({
          width: 80.5,
          height: 80,
          data: new Uint8ClampedArray(80 * 80 * 4),
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

  describe('analyseFeatures', () => {
    it('should return the features behind the verdict', () => {
      const detector = new SyntheticImageDetector();
      const imageData = createTestImage(100, 100, 'checkerboard');

      const features = detector.analyseFeatures(imageData);
      const result = detector.analyse(imageData);

      expect(result.metadata.features).toEqual(features);
      expect(result.metadata.primaryVariance).toBe(features.primaryVariance);
      expect(result.metadata.coherence).toBe(features.localCoherence);
    });

    it('should validate the image like analyse', () => {
      const detector = new SyntheticImageDetector();
      expect(() => detector.analyseFeatures(createTestImage(32, 32, 'gradient'))).toThrow(
        'Image too small'
      );
    });
  });

  describe('deprecated options', () => {
    it.each([
      ['numComponents', { numComponents: 1 }, { numComponents: 7 }],
      ['normaliseGradients', { normaliseGradients: true }, { normaliseGradients: false }],
      [
        'filterCompressionArtifacts',
        { filterCompressionArtifacts: true },
        { filterCompressionArtifacts: false },
      ],
    ])('%s should not change the result', (_name, a, b) => {
      const imageData = createTestImage(90, 90, 'gradient');
      expect(new SyntheticImageDetector(a).analyse(imageData)).toEqual(
        new SyntheticImageDetector(b).analyse(imageData)
      );
    });
  });

  describe('analyseGradients', () => {
    it('should only change scale when normaliseGradients is set', () => {
      const imageData = createTestImage(80, 80, 'gradient');
      const raw = new SyntheticImageDetector({ normaliseGradients: false }).analyseGradients(
        imageData
      );
      const normalised = new SyntheticImageDetector({ normaliseGradients: true }).analyseGradients(
        imageData
      );

      const ratio = normalised.gx[40][40] / raw.gx[40][40];
      expect(normalised.gx[10][30] / raw.gx[10][30]).toBeCloseTo(ratio, 10);
    });

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

    it('should reject invalid options and keep the existing ones', () => {
      const detector = new SyntheticImageDetector({ threshold: 0.6 });

      expect(() => detector.setOptions({ threshold: 2 })).toThrow(RangeError);
      expect(detector.getOptions().threshold).toBe(0.6);
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
