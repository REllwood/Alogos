/**
 * Represents image data in a format suitable for analysis
 */
export interface ImageData {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Pixel data in RGBA format (flattened array) */
  data: Uint8ClampedArray | number[];
}

/**
 * Represents a gradient field computed from an image
 */
export interface GradientField {
  /** Gradient in x-direction */
  gx: number[][];
  /** Gradient in y-direction */
  gy: number[][];
  /** Width of the gradient field */
  width: number;
  /** Height of the gradient field */
  height: number;
}

/**
 * Result of PCA analysis
 */
export interface PCAResult {
  /** Principal components (unit eigenvectors), ordered by decreasing variance */
  components: number[][];
  /** Fraction of the total variance explained by each returned component (0-1) */
  explainedVariance: number[];
  /** Projection of the centred data onto the first principal component */
  projection: number[];
  /** Total variance of the data (trace of the covariance matrix) */
  totalVariance: number;
}

/**
 * Detection result with confidence score
 */
export interface DetectionResult {
  /** Whether the image is likely synthetic (true) or real (false) */
  isSynthetic: boolean;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Raw score from the analysis (can be used for custom thresholding) */
  rawScore: number;
  /** Additional metadata about the analysis */
  metadata: {
    /** Number of pixels analysed */
    pixelsAnalysed: number;
    /** Variance explained by first principal component */
    primaryVariance: number;
    /** Gradient field coherence metric */
    coherence: number;
  };
}

/**
 * Configuration options for the detector
 */
export interface DetectorOptions {
  /** Threshold for synthetic detection (default: 0.5) */
  threshold?: number;
  /** Number of principal components to compute (default: 5) */
  numComponents?: number;
  /** Whether to normalise gradients (default: true) */
  normaliseGradients?: boolean;
  /** Minimum image dimension to process (default: 64) */
  minImageSize?: number;
  /** Apply high-pass filter to reduce JPEG compression artifacts (default: true) */
  filterCompressionArtifacts?: boolean;
}

