import {
  luminancePlane,
  filterPlane,
  normalisePlane,
  gradientStatistics,
  projectionKurtosis,
} from './analysis';
import {
  imageToluminanceMatrix,
  filterCompressionArtifacts,
  normaliseLuminance,
} from './luminance';
import { computeGradients, flattenGradientField, computeGradientCoherence } from './gradients';
import { computeCovarianceMatrix, performPCA, computePCAScore } from './pca';
import { SyntheticImageDetector } from './detector';
import { ImageData } from './types';

/** Deterministic pseudo-random generator (mulberry32) */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Image with smooth shading, hard edges and noise, so every statistic is non-trivial */
function texturedImage(width: number, height: number, seed: number): ImageData {
  const rand = random(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const shade = 100 + 60 * Math.sin(x / 9) * Math.cos(y / 13);
      const edge = x > width / 3 && y < (2 * height) / 3 ? 50 : 0;
      data[i] = shade + edge + rand() * 30;
      data[i + 1] = shade * 0.8 + edge + rand() * 30;
      data[i + 2] = shade * 0.6 + rand() * 30;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

const toMatrix = (plane: { data: Float32Array; width: number; height: number }) =>
  Array.from({ length: plane.height }, (_, y) =>
    Array.from(plane.data.subarray(y * plane.width, (y + 1) * plane.width))
  );

function expectMatricesClose(actual: number[][], expected: number[][], digits: number) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((row, y) =>
    row.forEach((value, x) => expect(value).toBeCloseTo(expected[y][x], digits))
  );
}

describe('Typed-array analysis pipeline', () => {
  const image = texturedImage(97, 83, 1);

  it('should compute the same luminance as imageToluminanceMatrix', () => {
    expectMatricesClose(toMatrix(luminancePlane(image)), imageToluminanceMatrix(image), 3);
  });

  it('should filter like filterCompressionArtifacts', () => {
    const plane = luminancePlane(image);
    const expected = filterCompressionArtifacts(toMatrix(plane));
    expectMatricesClose(toMatrix(filterPlane(plane)), expected, 3);
  });

  it('should normalise like normaliseLuminance', () => {
    const plane = luminancePlane(image);
    const expected = normaliseLuminance(toMatrix(plane));
    expectMatricesClose(toMatrix(normalisePlane(plane)), expected, 5);
  });

  it('should normalise a uniform plane to zeros', () => {
    const uniform = { data: new Float32Array(12).fill(7), width: 4, height: 3 };
    expect(Array.from(normalisePlane(uniform).data)).toEqual(new Array(12).fill(0));
  });

  it('should match the covariance of the flattened gradient field', () => {
    const plane = luminancePlane(image);
    const matrix = toMatrix(plane);
    const expected = computeCovarianceMatrix(flattenGradientField(computeGradients(matrix)));

    const stats = gradientStatistics(plane);

    expect(stats.count).toBe(image.width * image.height);
    expectMatricesClose(stats.covariance, expected, 6);
  });

  it('should handle single-row and single-column planes', () => {
    const row = { data: new Float32Array([1, 3, 6, 10]), width: 4, height: 1 };
    const column = { data: new Float32Array([1, 3, 6, 10]), width: 1, height: 4 };

    const rowStats = gradientStatistics(row);
    const columnStats = gradientStatistics(column);

    expect(rowStats.covariance[1][1]).toBe(0);
    expect(columnStats.covariance[0][0]).toBe(0);
    expect(rowStats.covariance[0][0]).toBeCloseTo(columnStats.covariance[1][1], 12);
  });

  it('should compute the kurtosis of a projection', () => {
    const plane = luminancePlane(image);
    const stats = gradientStatistics(plane);
    const pca = performPCA(flattenGradientField(computeGradients(toMatrix(plane))), 2);

    const projection = pca.projection;
    const n = projection.length;
    const mean = projection.reduce((a, b) => a + b, 0) / n;
    const m2 = projection.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const m4 = projection.reduce((a, b) => a + (b - mean) ** 4, 0) / n;

    expect(projectionKurtosis(plane, stats, pca.components[0])).toBeCloseTo(m4 / (m2 * m2), 6);
  });

  it('should return 0 kurtosis when the projection has no variance', () => {
    const flat = { data: new Float32Array(25).fill(3), width: 5, height: 5 };
    expect(projectionKurtosis(flat, gradientStatistics(flat), [1, 0])).toBe(0);
  });

  describe('detector parity with the reference pipeline', () => {
    function referenceAnalysis(img: ImageData, filter: boolean, normalise: boolean) {
      let luminance = imageToluminanceMatrix(img);
      if (filter) luminance = filterCompressionArtifacts(luminance);
      if (normalise) luminance = normaliseLuminance(luminance);
      const gradients = computeGradients(luminance);
      const pca = performPCA(flattenGradientField(gradients), 2);
      return {
        rawScore: computePCAScore(pca),
        primaryVariance: pca.explainedVariance[0],
        coherence: computeGradientCoherence(gradients),
      };
    }

    it.each([
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])('filter=%p normalise=%p', (filter, normalise) => {
      for (const seed of [1, 2, 3]) {
        const img = texturedImage(80, 70, seed);
        const expected = referenceAnalysis(img, filter, normalise);
        const result = new SyntheticImageDetector({
          filterCompressionArtifacts: filter,
          normaliseGradients: normalise,
        }).analyse(img);

        expect(result.rawScore).toBeCloseTo(expected.rawScore, 5);
        expect(result.metadata.primaryVariance).toBeCloseTo(expected.primaryVariance, 6);
        expect(result.metadata.coherence).toBeCloseTo(expected.coherence, 6);
      }
    });
  });
});
