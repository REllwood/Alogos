/**
 * Alogos - Synthetic Image Detection Library
 *
 * A lightweight library that estimates whether an image is AI-generated from statistics of its
 * luminance gradient field: gradient PCA, how heavy-tailed the gradients are, pixel-level
 * smoothness and local orientation coherence, combined by a small model fitted on labelled
 * real and AI-generated images.
 *
 * The result is an interpretable signal, not proof. See the README for measured accuracy and
 * known failure cases.
 *
 * @packageDocumentation
 */

// Main detector
export { SyntheticImageDetector, detectSyntheticImage } from './detector';

// Types
export type {
  ImageData,
  GradientField,
  PCAResult,
  DetectionResult,
  DetectorOptions,
} from './types';
export type { ImageFeatures } from './features';

// Utility functions for advanced usage
export {
  rgbToLuminance,
  imageToLuminanceMatrix,
  imageToluminanceMatrix,
  normaliseLuminance,
  filterCompressionArtifacts,
} from './luminance';
export { computeGradients, flattenGradientField, computeGradientCoherence } from './gradients';
export { performPCA, computePCAScore, computeCovarianceMatrix } from './pca';

// Version
export const VERSION = '1.0.0';
