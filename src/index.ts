/**
 * Alogos - Synthetic Image Detection Library
 * 
 * A lightweight library for detecting synthetic images using luminance-gradient PCA analysis.
 * 
 * Real images produce coherent gradient fields tied to physical lighting and sensor characteristics,
 * while diffusion-generated images show unstable high-frequency structures from the denoising process.
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

// Utility functions for advanced usage
export { 
  rgbToLuminance, 
  imageToluminanceMatrix, 
  normaliseLuminance,
  filterCompressionArtifacts 
} from './luminance';
export {
  computeGradients,
  flattenGradientField,
  computeGradientCoherence,
} from './gradients';
export { performPCA, computePCAScore, computeCovarianceMatrix } from './pca';

// Version
export const VERSION = '1.0.0';

