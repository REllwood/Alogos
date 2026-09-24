import { ImageData, DetectionResult, DetectorOptions, GradientField } from './types';
import { imageToLuminanceMatrix, normaliseLuminance } from './luminance';
import { computeGradients } from './gradients';
import { luminancePlane } from './analysis';
import { extractFeatures, ImageFeatures } from './features';
import { syntheticProbability } from './scoring';
import { computeConfidence } from './confidence';

/**
 * Default detector options
 */
const DEFAULT_OPTIONS: Required<DetectorOptions> = {
  threshold: 0.5,
  numComponents: 5,
  normaliseGradients: true,
  minImageSize: 64,
  filterCompressionArtifacts: true,
};

/**
 * Merges option overrides into a base set, ignoring overrides that are undefined
 *
 * @param base - Complete set of options
 * @param overrides - Options to apply on top
 * @returns Merged options
 */
function mergeOptions(
  base: Required<DetectorOptions>,
  overrides: DetectorOptions
): Required<DetectorOptions> {
  const merged = { ...base };
  for (const key of Object.keys(overrides) as (keyof DetectorOptions)[]) {
    if (overrides[key] !== undefined) {
      (merged as Record<keyof DetectorOptions, unknown>)[key] = overrides[key];
    }
  }
  return merged;
}

/**
 * Checks that detector options are usable
 *
 * @param options - Complete set of options to validate
 * @throws RangeError or TypeError describing the first invalid option
 */
function validateOptions(options: Required<DetectorOptions>): void {
  const { threshold, numComponents, minImageSize, normaliseGradients, filterCompressionArtifacts } =
    options;

  if (typeof threshold !== 'number' || !(threshold > 0 && threshold < 1)) {
    throw new RangeError(
      `threshold must be a number between 0 and 1 (exclusive), got ${threshold}`
    );
  }
  if (!Number.isInteger(numComponents) || numComponents < 1) {
    throw new RangeError(`numComponents must be a positive integer, got ${numComponents}`);
  }
  if (!Number.isInteger(minImageSize) || minImageSize < 3) {
    throw new RangeError(`minImageSize must be an integer of at least 3, got ${minImageSize}`);
  }
  if (typeof normaliseGradients !== 'boolean') {
    throw new TypeError(`normaliseGradients must be a boolean, got ${typeof normaliseGradients}`);
  }
  if (typeof filterCompressionArtifacts !== 'boolean') {
    throw new TypeError(
      `filterCompressionArtifacts must be a boolean, got ${typeof filterCompressionArtifacts}`
    );
  }
}

/**
 * Main detector class for synthetic image detection
 */
export class SyntheticImageDetector {
  private options: Required<DetectorOptions>;

  /**
   * @param options - Detector configuration (unspecified options use defaults)
   * @throws RangeError or TypeError if an option is invalid
   */
  constructor(options: DetectorOptions = {}) {
    const merged = mergeOptions(DEFAULT_OPTIONS, options);
    validateOptions(merged);
    this.options = merged;
  }

  /**
   * Analyses an image to determine if it's synthetic
   *
   * Computes seven statistics of the image's luminance gradient field (see
   * `ImageFeatures`) and converts them into a probability with a model fitted
   * on labelled real and AI-generated images. Treat the result as one signal
   * among many: see the README for measured accuracy and known failure cases.
   *
   * @param imageData - Image data in RGBA format
   * @returns Detection result with confidence score
   * @throws Error if the image data is invalid or smaller than `minImageSize`
   */
  public analyse(imageData: ImageData): DetectionResult {
    const features = this.analyseFeatures(imageData);
    const rawScore = syntheticProbability(features);

    return {
      isSynthetic: rawScore >= this.options.threshold,
      confidence: computeConfidence(rawScore, this.options.threshold),
      rawScore,
      metadata: {
        pixelsAnalysed: imageData.width * imageData.height,
        primaryVariance: features.primaryVariance,
        coherence: features.localCoherence,
        features,
      },
    };
  }

  /**
   * Computes the gradient-field features the detector's verdict is based on
   *
   * @param imageData - Image data in RGBA format
   * @returns Feature values
   * @throws Error if the image data is invalid or smaller than `minImageSize`
   */
  public analyseFeatures(imageData: ImageData): ImageFeatures {
    this.validateImageData(imageData);

    if (
      imageData.width < this.options.minImageSize ||
      imageData.height < this.options.minImageSize
    ) {
      throw new Error(
        `Image too small. Minimum size is ${this.options.minImageSize}x${this.options.minImageSize} pixels`
      );
    }

    return extractFeatures(luminancePlane(imageData));
  }

  /**
   * Returns the luminance gradient field of an image, for debugging and visualisation
   *
   * Uses central differences in the interior and one-sided differences at the
   * edges. The detector itself only uses interior gradients. If
   * `normaliseGradients` is set, luminance is rescaled to [0, 1] first, which
   * changes the scale of the field but not the detector's result. The field is
   * returned as nested arrays, which use far more memory than `analyse()` for
   * large images.
   *
   * @param imageData - Image data in RGBA format
   * @returns Gradient field data
   */
  public analyseGradients(imageData: ImageData): GradientField {
    this.validateImageData(imageData);

    const luminanceMatrix = imageToLuminanceMatrix(imageData);
    const processed = this.options.normaliseGradients
      ? normaliseLuminance(luminanceMatrix)
      : luminanceMatrix;

    return computeGradients(processed);
  }

  /**
   * Updates detector options
   *
   * @param options - New options to merge with existing
   * @throws RangeError or TypeError if an option is invalid (existing options are kept)
   */
  public setOptions(options: Partial<DetectorOptions>): void {
    const merged = mergeOptions(this.options, options);
    validateOptions(merged);
    this.options = merged;
  }

  /**
   * Gets current detector options
   *
   * @returns Current options
   */
  public getOptions(): Required<DetectorOptions> {
    return { ...this.options };
  }

  /**
   * Validates image data structure
   *
   * @param imageData - Image data to validate
   * @throws Error if image data is invalid
   */
  private validateImageData(imageData: ImageData): void {
    if (!imageData) {
      throw new Error('Image data is required');
    }

    if (
      !Number.isInteger(imageData.width) ||
      !Number.isInteger(imageData.height) ||
      imageData.width <= 0 ||
      imageData.height <= 0
    ) {
      throw new Error('Invalid image dimensions');
    }

    if (!imageData.data || imageData.data.length === 0) {
      throw new Error('Image data is empty');
    }

    const expectedLength = imageData.width * imageData.height * 4;
    if (imageData.data.length !== expectedLength) {
      throw new Error(
        `Image data length mismatch. Expected ${expectedLength} bytes (RGBA), got ${imageData.data.length}`
      );
    }
  }
}

/**
 * Convenience function to analyse a single image
 * Creates a detector instance with default options
 *
 * @param imageData - Image data in RGBA format
 * @param options - Optional detector configuration
 * @returns Detection result
 */
export function detectSyntheticImage(
  imageData: ImageData,
  options?: DetectorOptions
): DetectionResult {
  const detector = new SyntheticImageDetector(options);
  return detector.analyse(imageData);
}
