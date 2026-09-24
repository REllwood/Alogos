import { ImageFeatures } from './features';
import { MODEL } from './model';

/**
 * Converts gradient-field features into the probability that an image is AI-generated
 *
 * Applies the quadratic logistic regression in `model.ts`, fitted on labelled
 * real and AI-generated images with the two classes weighted equally (see
 * research/README.md). A value of 0.5 therefore means the features are equally
 * consistent with either class.
 *
 * @param features - Features from `extractFeatures`
 * @returns Probability between 0 and 1
 */
export function syntheticProbability(features: ImageFeatures): number {
  const z = MODEL.features.map((name, i) => {
    const standardised = (features[name] - MODEL.mean[i]) / MODEL.scale[i];
    return Math.max(-MODEL.clip, Math.min(MODEL.clip, standardised));
  });

  let logit = MODEL.intercept;
  for (let i = 0; i < z.length; i++) {
    logit += MODEL.linear[i] * z[i];
  }
  for (const [i, j, weight] of MODEL.quadratic) {
    logit += weight * z[i] * z[j];
  }

  return 1 / (1 + Math.exp(-logit));
}
