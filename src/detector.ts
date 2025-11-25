import { ImageData, DetectionResult, DetectorOptions, GradientField } from './types';
import { imageToluminanceMatrix, normaliseLuminance, filterCompressionArtifacts } from './luminance';
import { computeGradients, flattenGradientField, computeGradientCoherence } from './gradients';
import { performPCA, computePCAScore } from './pca';

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
 * Main detector class for synthetic image detection
 */
export class SyntheticImageDetector {
  private options: Required<DetectorOptions>;

  constructor(options: DetectorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyses an image to determine if it's synthetic
   * 
   * @param imageData - Image data in RGBA format
   * @returns Detection result with confidence score
   */
  public analyse(imageData: ImageData): DetectionResult {
    // Validate input
    this.validateImageData(imageData);

    // Check minimum size
    if (
      imageData.width < this.options.minImageSize ||
      imageData.height < this.options.minImageSize
    ) {
      throw new Error(
        `Image too small. Minimum size is ${this.options.minImageSize}x${this.options.minImageSize} pixels`
      );
    }

    // Step 1: Convert RGB to luminance
    let luminanceMatrix = imageToluminanceMatrix(imageData);

    // Step 2: Optionally filter compression artifacts
    if (this.options.filterCompressionArtifacts) {
      luminanceMatrix = filterCompressionArtifacts(luminanceMatrix);
    }

    // Step 3: Optionally normalise
    const processedLuminance = this.options.normaliseGradients
      ? normaliseLuminance(luminanceMatrix)
      : luminanceMatrix;

    // Step 4: Compute spatial gradients
    const gradientField = computeGradients(processedLuminance);

    // Step 5: Flatten gradient field into matrix
    const gradientMatrix = flattenGradientField(gradientField);

    // Step 6: Perform PCA analysis
    const pcaResult = performPCA(gradientMatrix, this.options.numComponents);

    // Step 7: Compute detection score
    const rawScore = computePCAScore(pcaResult);

    // Step 8: Compute additional metrics
    const coherence = computeGradientCoherence(gradientField);
    const primaryVariance = pcaResult.explainedVariance[0] || 0;

    // Determine if synthetic based on threshold
    const isSynthetic = rawScore >= this.options.threshold;

    // Confidence is the distance from threshold
    const confidence = Math.abs(rawScore - this.options.threshold) / this.options.threshold;

    return {
      isSynthetic,
      confidence: Math.min(1, confidence),
      rawScore,
      metadata: {
        pixelsAnalysed: imageData.width * imageData.height,
        primaryVariance,
        coherence,
      },
    };
  }

  /**
   * Analyses an image and returns detailed gradient analysis
   * Useful for debugging and visualisation
   * 
   * @param imageData - Image data in RGBA format
   * @returns Gradient field data
   */
  public analyseGradients(imageData: ImageData): GradientField {
    this.validateImageData(imageData);

    const luminanceMatrix = imageToluminanceMatrix(imageData);
    const processedLuminance = this.options.normaliseGradients
      ? normaliseLuminance(luminanceMatrix)
      : luminanceMatrix;

    return computeGradients(processedLuminance);
  }

  /**
   * Updates detector options
   * 
   * @param options - New options to merge with existing
   */
  public setOptions(options: Partial<DetectorOptions>): void {
    this.options = { ...this.options, ...options };
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
      typeof imageData.width !== 'number' ||
      typeof imageData.height !== 'number' ||
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

