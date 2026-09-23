import { computeConfidence } from './confidence';

describe('computeConfidence', () => {
  it('should be 0 at the threshold', () => {
    for (const threshold of [0.1, 0.5, 0.9]) {
      expect(computeConfidence(threshold, threshold)).toBe(0);
    }
  });

  it('should reach 1 at both ends of the score range for any threshold', () => {
    for (const threshold of [0.1, 0.2, 0.5, 0.7, 0.9]) {
      expect(computeConfidence(1, threshold)).toBe(1);
      expect(computeConfidence(0, threshold)).toBe(1);
    }
  });

  it('should scale a synthetic verdict by the distance from the threshold to 1', () => {
    expect(computeConfidence(0.85, 0.7)).toBeCloseTo(0.5, 12);
    expect(computeConfidence(0.95, 0.9)).toBeCloseTo(0.5, 12);
  });

  it('should scale a real verdict by the distance from the threshold to 0', () => {
    expect(computeConfidence(0.35, 0.7)).toBeCloseTo(0.5, 12);
    expect(computeConfidence(0.1, 0.2)).toBeCloseTo(0.5, 12);
  });

  it('should stay within [0, 1]', () => {
    for (const threshold of [0.05, 0.5, 0.95]) {
      for (let raw = 0; raw <= 1; raw += 0.05) {
        const confidence = computeConfidence(raw, threshold);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});
