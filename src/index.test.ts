import * as alogos from './index';

describe('Package Exports', () => {
  it('should export SyntheticImageDetector', () => {
    expect(alogos.SyntheticImageDetector).toBeDefined();
    expect(typeof alogos.SyntheticImageDetector).toBe('function');
  });

  it('should export detectSyntheticImage', () => {
    expect(alogos.detectSyntheticImage).toBeDefined();
    expect(typeof alogos.detectSyntheticImage).toBe('function');
  });

  it('should export utility functions', () => {
    expect(alogos.rgbToLuminance).toBeDefined();
    expect(alogos.imageToluminanceMatrix).toBeDefined();
    expect(alogos.normaliseLuminance).toBeDefined();
    expect(alogos.computeGradients).toBeDefined();
    expect(alogos.flattenGradientField).toBeDefined();
    expect(alogos.computeGradientCoherence).toBeDefined();
    expect(alogos.performPCA).toBeDefined();
    expect(alogos.computePCAScore).toBeDefined();
    expect(alogos.computeCovarianceMatrix).toBeDefined();
  });

  it('should export VERSION', () => {
    expect(alogos.VERSION).toBeDefined();
    expect(typeof alogos.VERSION).toBe('string');
    expect(alogos.VERSION).toBe('1.0.0');
  });
});

