import { extractFeatures, ImageFeatures } from './features';
import { luminancePlane, LuminancePlane } from './analysis';
import { syntheticProbability } from './scoring';
import { ImageData } from './types';
import reference from './__fixtures__/reference.json';

/**
 * Deterministic fixture images, generated with integer arithmetic so that
 * research/fixtures.py produces identical pixels
 */
function fixtureValue(kind: string, x: number, y: number, c: number): number {
  const hash = ((x * 73856093) ^ (y * 19349663) ^ (c * 83492791)) & 0xffff;
  let v: number;
  if (kind === 'textured') {
    v = ((x * 3 + y * 5) % 97) + (((x * y) >> 5) % 61) + (hash % 37) + (x > 40 && y < 50 ? 60 : 0);
  } else if (kind === 'smooth') {
    v = (((x * x + y * y) >> 4) % 256) + (hash % 3);
  } else {
    v = ((x >> 2) % 2) * 200 + (hash % 5);
  }
  return Math.min(255, Math.max(0, v));
}

const FIXTURE_SIZES: Record<string, [number, number]> = {
  textured: [96, 80],
  smooth: [64, 64],
  stripes: [72, 72],
};

function fixtureImage(kind: string): ImageData {
  const [width, height] = FIXTURE_SIZES[kind];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = fixtureValue(kind, x, y, c);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

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

/** Approximately Gaussian noise (sum of uniforms) */
function noisePlane(width: number, height: number, seed: number, sd = 20): LuminancePlane {
  const rand = random(seed);
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    let s = 0;
    for (let k = 0; k < 12; k++) s += rand();
    data[i] = 128 + (s - 6) * sd;
  }
  return { data, width, height };
}

function mapPlane(plane: LuminancePlane, f: (v: number) => number): LuminancePlane {
  return { ...plane, data: plane.data.map(f) };
}

/** 3 × 3 box blur (edges left unchanged) */
function blur(plane: LuminancePlane): LuminancePlane {
  const { data, width, height } = plane;
  const out = new Float32Array(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) sum += data[(y + dy) * width + x + dx];
      }
      out[y * width + x] = sum / 9;
    }
  }
  return { data: out, width, height };
}

describe('extractFeatures', () => {
  describe('parity with the Python reference used for training', () => {
    it.each(Object.keys(FIXTURE_SIZES))('%s fixture', (kind) => {
      const expected = (
        reference as Record<string, { features: ImageFeatures; probability: number }>
      )[kind];
      const features = extractFeatures(luminancePlane(fixtureImage(kind)));

      for (const [name, value] of Object.entries(expected.features)) {
        expect(features[name as keyof ImageFeatures]).toBeCloseTo(value, 5);
      }
      expect(syntheticProbability(features)).toBeCloseTo(expected.probability, 5);
    });
  });

  it('should not depend on brightness or contrast', () => {
    const plane = luminancePlane(fixtureImage('textured'));
    const base = extractFeatures(plane);
    const rescaled = extractFeatures(mapPlane(plane, (v) => 20 + v * 0.5));

    for (const name of Object.keys(base) as (keyof ImageFeatures)[]) {
      expect(rescaled[name]).toBeCloseTo(base[name], 4);
    }
  });

  it('should give Gaussian-noise values for noise', () => {
    const features = extractFeatures(noisePlane(200, 200, 1));

    expect(features.primaryVariance).toBeGreaterThan(0.5);
    expect(features.primaryVariance).toBeLessThan(0.53);
    expect(features.logKurtosis).toBeCloseTo(Math.log(3), 1);
    // Neighbouring central differences of white noise share no samples
    expect(Math.abs(features.gradientCorrelation)).toBeLessThan(0.05);
    expect(features.localCoherence).toBeLessThan(0.3);
  });

  it('should detect a single dominant orientation in stripes', () => {
    const features = extractFeatures(luminancePlane(fixtureImage('stripes')));

    expect(features.primaryVariance).toBeGreaterThan(0.99);
    expect(features.localCoherence).toBeGreaterThan(0.99);
  });

  it('should return neutral values when there are no gradients', () => {
    const flat = { data: new Float32Array(64 * 64).fill(90), width: 64, height: 64 };
    const tiny = { data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 };

    for (const plane of [flat, tiny]) {
      const features = extractFeatures(plane);
      expect(features.primaryVariance).toBe(0.5);
      expect(features.localCoherence).toBe(0);
      for (const value of Object.values(features)) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('should see less fine detail and smoother gradients after blurring', () => {
    const noisy = noisePlane(160, 160, 2);
    const sharp = extractFeatures(noisy);
    const smooth = extractFeatures(blur(noisy));

    expect(smooth.logFineToCoarse).toBeLessThan(sharp.logFineToCoarse);
    expect(smooth.logResidual).toBeLessThan(sharp.logResidual);
    expect(smooth.gradientCorrelation).toBeGreaterThan(sharp.gradientCorrelation);
  });
});

describe('syntheticProbability', () => {
  it('should stay within [0, 1] even for extreme features', () => {
    const extreme: ImageFeatures = {
      primaryVariance: 1,
      logKurtosis: 50,
      logFineToCoarse: -50,
      logResidual: 50,
      logCross: -50,
      gradientCorrelation: 1,
      localCoherence: 1,
    };
    const p = syntheticProbability(extreme);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('should rate a smoothed photo-like image as more likely synthetic than the original', () => {
    // Pixel-level smoothness is the strongest cue the model learned: AI images carry less
    // fine-scale texture and noise than camera photos
    const textured = luminancePlane(fixtureImage('textured'));
    const original = syntheticProbability(extractFeatures(textured));
    const smoothed = syntheticProbability(extractFeatures(blur(textured)));

    expect(smoothed).toBeGreaterThan(original);
  });
});
