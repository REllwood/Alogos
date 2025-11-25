# Alogos

> A lightweight JavaScript library for detecting synthetic images using luminance-gradient PCA analysis

[![NPM Version](https://img.shields.io/npm/v/alogos.svg)](https://www.npmjs.com/package/alogos)
[![License](https://img.shields.io/npm/l/alogos.svg)](https://github.com/REllwood/alogos/blob/main/LICENCE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Overview

Alogos provides a simple yet effective way to distinguish between real photographs and AI-generated (diffusion model) images by analysing their gradient fields.

Real images produce coherent gradient fields tied to physical lighting and sensor characteristics, while diffusion-generated images show unstable high-frequency structures from the denoising process. By converting RGB to luminance, computing spatial gradients, and evaluating the covariance through PCA, the difference becomes visible in a single projection.

This provides a lightweight and interpretable way to assess image authenticity without relying on metadata or complex classifier models.

**ELI5:**
Light in the real world behaves in smooth and predictable ways, cameras capture light using sensors that known and consistent patterns. This creates smooth and coherent gradients (changes to light to dark).
But AI generated images using diffusion models, generate images by repeatedly removing noise, this process creates tiny unstable high-frequency wiggles in the brightness patterns. These are not obvious to the human eye, but these show up in gradient data. 

## Features

- **Simple API** - Easy to use with sensible defaults
- **Scientific Approach** - Based on gradient field analysis and PCA
- **Lightweight** - No heavy dependencies
- **Fast** - Efficient algorithms suitable for real-time analysis
- **Interpretable** - Provides detailed metrics and confidence scores
- **Configurable** - Customisable thresholds and parameters
- **TypeScript** - Full type definitions included
- **Well-tested** - Comprehensive test coverage

## Installation

```bash
npm install alogos
```

Or with yarn:

```bash
yarn add alogos
```

## Quick Start

```typescript
import { detectSyntheticImage } from 'alogos';

// Assume you have image data in RGBA format
const imageData = {
  width: 800,
  height: 600,
  data: new Uint8ClampedArray(800 * 600 * 4), // RGBA pixel data
};

// Analyse the image
const result = detectSyntheticImage(imageData);

console.log(`Is synthetic: ${result.isSynthetic}`);
console.log(`Confidence: ${result.confidence.toFixed(2)}`);
console.log(`Raw score: ${result.rawScore.toFixed(3)}`);
```

## Usage

### Basic Usage

```typescript
import { SyntheticImageDetector } from 'alogos';

// Create a detector instance
const detector = new SyntheticImageDetector();

// Analyse an image
const result = detector.analyse(imageData);

if (result.isSynthetic) {
  console.log(`This image is likely synthetic (confidence: ${result.confidence})`);
} else {
  console.log(`This image is likely real (confidence: ${result.confidence})`);
}
```

### With Custom Options

```typescript
import { SyntheticImageDetector } from 'alogos';

const detector = new SyntheticImageDetector({
  threshold: 0.7,           // Custom detection threshold (0-1)
  numComponents: 10,        // More principal components for analysis
  normaliseGradients: true, // Normalise gradient values
  minImageSize: 128,        // Minimum image dimension
});

const result = detector.analyse(imageData);
```

### Getting Image Data from Canvas

```typescript
// In a browser environment
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const result = detectSyntheticImage(imageData);
```

### Getting Image Data from File (Node.js)

You'll need a library like `canvas` or `sharp` to read images in Node.js:

```typescript
import { createCanvas, loadImage } from 'canvas';
import { detectSyntheticImage } from 'alogos';

async function analyseImageFile(imagePath: string) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  
  return detectSyntheticImage(imageData);
}

// Usage
const result = await analyseImageFile('./photo.jpg');
console.log(result);
```

### Advanced: Gradient Field Analysis

```typescript
import { SyntheticImageDetector } from 'alogos';

const detector = new SyntheticImageDetector();

// Get detailed gradient information
const gradientField = detector.analyseGradients(imageData);

console.log('Gradient dimensions:', gradientField.width, 'x', gradientField.height);
console.log('X-gradient at (10, 10):', gradientField.gx[10][10]);
console.log('Y-gradient at (10, 10):', gradientField.gy[10][10]);
```

### Advanced: Using Low-Level APIs

```typescript
import {
  imageToluminanceMatrix,
  computeGradients,
  flattenGradientField,
  performPCA,
  computePCAScore,
} from 'alogos';

// Step-by-step analysis
const luminance = imageToluminanceMatrix(imageData);
const gradients = computeGradients(luminance);
const gradientMatrix = flattenGradientField(gradients);
const pcaResult = performPCA(gradientMatrix, 5);
const score = computePCAScore(pcaResult);

console.log('Detection score:', score);
console.log('Primary variance:', pcaResult.explainedVariance[0]);
```

## API Reference

### Main Classes

#### `SyntheticImageDetector`

The main detector class.

**Constructor:**
```typescript
new SyntheticImageDetector(options?: DetectorOptions)
```

**Methods:**
- `analyse(imageData: ImageData): DetectionResult` - Analyses an image
- `analyseGradients(imageData: ImageData): GradientField` - Returns gradient field
- `setOptions(options: Partial<DetectorOptions>): void` - Updates options
- `getOptions(): Required<DetectorOptions>` - Gets current options

### Functions

#### `detectSyntheticImage(imageData, options?)`

Convenience function to analyse a single image with default options.

### Types

#### `ImageData`
```typescript
interface ImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}
```

#### `DetectionResult`
```typescript
interface DetectionResult {
  isSynthetic: boolean;
  confidence: number;
  rawScore: number;
  metadata: {
    pixelsAnalysed: number;
    primaryVariance: number;
    coherence: number;
  };
}
```

#### `DetectorOptions`
```typescript
interface DetectorOptions {
  threshold?: number;                      // Default: 0.5
  numComponents?: number;                  // Default: 5
  normaliseGradients?: boolean;            // Default: true
  minImageSize?: number;                   // Default: 64
  filterCompressionArtifacts?: boolean;    // Default: true
}
```

#### `GradientField`
```typescript
interface GradientField {
  gx: number[][];
  gy: number[][];
  width: number;
  height: number;
}
```

## How It Works

Alogos uses a multi-step process to analyse images:

1. **RGB to Luminance Conversion**: Converts colour images to greyscale using the standard photometric formula: `L = 0.2126 × R + 0.7152 × G + 0.0722 × B`

2. **Gradient Computation**: Calculates spatial gradients using central differences:
   - `Gx(x,y) = [L(x+1,y) - L(x-1,y)] / 2`
   - `Gy(x,y) = [L(x,y+1) - L(x,y-1)] / 2`

3. **Matrix Formation**: Flattens the gradient field into an N×2 matrix where N is the number of pixels

4. **Covariance Analysis**: Computes the covariance matrix: `C = (1/N) × M^T × M`

5. **PCA Decomposition**: Performs eigendecomposition to find principal components

6. **Score Computation**: Analyses variance distribution and projection statistics to determine likelihood of synthesis

Real photographs tend to show:
- Higher coherence in gradient fields
- More concentrated variance in primary components
- Gaussian-like projection distributions

Synthetic images tend to show:
- Unstable high-frequency gradient structures
- More dispersed variance across components
- Heavy-tailed projection distributions (higher kurtosis)

## Performance

Typical performance on a modern CPU:
- **Small images** (256×256): ~10-20ms
- **Medium images** (512×512): ~40-80ms
- **Large images** (1024×1024): ~150-300ms

Performance scales roughly with O(n) where n is the number of pixels.

## Limitations

- Requires images to be at least 64×64 pixels
- Works best on images with natural content
- May produce false positives on heavily processed or filtered real images
- Detection accuracy depends on the quality and type of synthetic generation model
- Not foolproof - should be used as one signal among many for authenticity verification

### Important Considerations

**JPEG Compression Artifacts**: A significant consideration in synthetic image detection is that real photographs are often JPEG compressed, while synthetic images may be saved as PNG or with minimal compression. This compression difference can create detectable patterns. As noted in research like the "JPEG or Fake" paper, some detection methods inadvertently learn to detect JPEG compression artifacts rather than true synthetic features.

**Mitigation in Alogos**: 
By default, Alogos applies a high-pass filter (`filterCompressionArtifacts: true`) to reduce the impact of JPEG block artifacts and focus on high-frequency patterns characteristic of diffusion models. This can be disabled if needed:

```typescript
const detector = new SyntheticImageDetector({
  filterCompressionArtifacts: false  // Disable if analysing uncompressed images
});
```

**Best Practices**:
- The default settings are optimised for mixed compression scenarios
- For research or validation, test with consistent compression across all images
- Be aware that detection is probabilistic - use as one signal among many
- Consider the image source and processing history in your interpretation

## Contributing

Contributions are welcome! Please open an issue or submit a Pull Request on GitHub.

## Licence

MIT

## Acknowledgements

This library implements the gradient field analysis technique for synthetic image detection discovered and documented by [Kavishka Abeywardhana](https://lk.linkedin.com/in/kavishka-abeywardhana-01b891214). 

The approach was originally shared in [this LinkedIn post](https://www.linkedin.com/posts/kavishka-abeywardhana-01b891214_synthetic-image-detection-using-gradient-activity-7397874600769982465-TC0c), where Kavishka demonstrated that luminance-gradient PCA analysis reveals consistent separation between real photographs and diffusion-generated images.

All credit for the discovery and methodology goes to Kavishka Abeywardhana. This library is simply an implementation of his technique made available for the JavaScript/TypeScript ecosystem.

## Further Reading

- [JPEG or Fake? Revealing Common Biases in Generated Image Detection Datasets](https://arxiv.org/abs/2308.10395) - Important research on compression artifacts
- [Kavishka Abeywardhana's Original Post](https://www.linkedin.com/posts/kavishka-abeywardhana-01b891214_synthetic-image-detection-using-gradient-activity-7397874600769982465-TC0c) - The original gradient field technique 

## Support

If you find this library useful, please consider:
- Starring the repository
- Reporting bugs
- Suggesting features
- Improving documentation



## Citation

If you use Alogos in academic work, please cite:

```bibtex
@software{alogos2025,
  title={Alogos: Synthetic Image Detection using Gradient Fields},
  author={Ellwood, Rhys},
  note={Implementation of technique by Kavishka Abeywardhana},
  year={2025},
  url={https://github.com/REllwood/alogos}
}
```

Please also cite the original technique:

```bibtex
@misc{abeywardhana2025gradient,
  title={Synthetic Image Detection using Gradient Fields},
  author={Abeywardhana, Kavishka},
  year={2025},
  url={https://www.linkedin.com/posts/kavishka-abeywardhana-01b891214_synthetic-image-detection-using-gradient-activity-7397874600769982465-TC0c}
}
```

