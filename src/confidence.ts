/**
 * Converts a raw score into a confidence for the verdict it produced
 *
 * Confidence is the distance from the threshold as a fraction of the distance
 * to the relevant end of the score range: 0 at the threshold, 1 at a score of
 * 0 (for a "real" verdict) or 1 (for a "synthetic" verdict). This keeps both
 * verdicts on the same scale whatever the threshold.
 *
 * @param rawScore - Score between 0 and 1
 * @param threshold - Decision threshold between 0 and 1 (exclusive)
 * @returns Confidence between 0 and 1
 */
export function computeConfidence(rawScore: number, threshold: number): number {
  const confidence =
    rawScore >= threshold
      ? (rawScore - threshold) / (1 - threshold)
      : (threshold - rawScore) / threshold;
  return Math.max(0, Math.min(1, confidence));
}
