import { readFileSync } from 'fs';
import { join } from 'path';
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
    expect(alogos.imageToLuminanceMatrix).toBeDefined();
    expect(alogos.imageToluminanceMatrix).toBeDefined();
    expect(alogos.filterCompressionArtifacts).toBeDefined();
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
  });

  it('should keep VERSION in sync with package.json', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    expect(alogos.VERSION).toBe(pkg.version);
  });
});

