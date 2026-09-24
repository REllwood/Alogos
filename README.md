# Alogos

> A lightweight JavaScript library that estimates whether an image is AI-generated from the statistics of its luminance gradient field

[![NPM Version](https://img.shields.io/npm/v/alogos.svg)](https://www.npmjs.com/package/alogos)
[![CI](https://github.com/REllwood/alogos/actions/workflows/ci.yml/badge.svg)](https://github.com/REllwood/alogos/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> **Read this first.** Alogos gives a weak, interpretable signal, not proof. On the kinds of
> images it was trained on it labels about 3 in 4 images correctly; on cameras and generators
> it has not seen, it can be little better than a coin flip. Never use it on its own to decide
> whether an image is real. See [Accuracy](#accuracy) and [Limitations](#limitations).

## Overview

Alogos looks at how brightness changes from pixel to pixel (the image's *gradient field*) and
measures seven statistics of it, such as how much fine, pixel-level detail the image carries and
how consistently its edges are oriented. A small model, fitted on thousands of labelled real and
AI-generated images, turns those statistics into a probability that the image is AI-generated.

It has no runtime dependencies, runs in browsers and Node.js, and analyses a 1-megapixel image in
a few tens of milliseconds.

**ELI5:**
A camera records light through a sensor, and every photo carries a fine, grainy texture from the
sensor and the lens. Image generators build pictures by gradually removing noise, and the
pictures they produce tend to be smoother than that at the level of individual pixels. Alogos
measures that texture, along with a few other properties of the image's edges. The difference is
real but small, easily blurred by editing, and not the same for every camera or generator, so
the answer is a probability rather than a verdict.

## Features

- **Simple API** - one call with sensible defaults
- **Calibrated** - `rawScore` is a probability; scores near 0 or 1 are much more reliable than scores near 0.5
- **Interpretable** - every verdict comes with the seven named features behind it
- **Measured** - accuracy on public datasets is documented and reproducible (see [`research/`](research/README.md))
- **Lightweight** - no runtime dependencies, about 40 kB
- **Fast** - streaming analysis: about 40 ms for 1 megapixel, under half a second for a 12-megapixel photo
- **TypeScript** - full type definitions for both ES modules and CommonJS

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

// Image data in RGBA format, e.g. from a canvas
const imageData = {
  width: 800,
  height: 600,
  data: new Uint8ClampedArray(800 * 600 * 4), // RGBA pixel data
};

const result = detectSyntheticImage(imageData);

console.log(`Likely AI-generated: ${result.isSynthetic}`);
console.log(`Probability AI-generated: ${result.rawScore.toFixed(2)}`);
console.log(`Confidence in verdict: ${result.confidence.toFixed(2)}`);
```

CommonJS works too:

```javascript
const { detectSyntheticImage } = require('alogos');
```

## Usage

### Basic Usage

```typescript
import { SyntheticImageDetector } from 'alogos';

const detector = new SyntheticImageDetector();
const result = detector.analyse(imageData);

if (result.rawScore >= 0.8) {
  console.log('Strong signs of AI generation');
} else if (result.rawScore <= 0.2) {
  console.log('Looks like a camera photo');
} else {
  console.log('Inconclusive');
}
```

### Choosing a Threshold

`isSynthetic` is `rawScore >= threshold` (default `0.5`). Raise the threshold to reduce false
alarms on real photos at the cost of missing more AI-generated images:

```typescript
const detector = new SyntheticImageDetector({
  threshold: 0.8, // only flag images with strong signs of AI generation
  minImageSize: 128, // reject images smaller than 128 × 128
});
```

### Getting Image Data from a Canvas

```typescript
// In a browser
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const result = detectSyntheticImage(imageData);
```

Analyse the image at its original size. Drawing it onto a smaller canvas resizes it, which
changes the pixel-level statistics the detector relies on (see [Limitations](#limitations)).

### Getting Image Data from a File (Node.js)

Use a library such as `sharp` to decode the image:

```typescript
import sharp from 'sharp';
import { detectSyntheticImage } from 'alogos';

async function analyseImageFile(path: string) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return detectSyntheticImage({
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  });
}

const result = await analyseImageFile('./photo.jpg');
console.log(result);
```

### Inspecting the Features Behind a Verdict

```typescript
const result = detector.analyse(imageData);
console.log(result.metadata.features);
// For example:
// {
//   primaryVariance: 0.57,
//   logKurtosis: 2.8,
//   logFineToCoarse: -0.36,
//   logResidual: -1.28,
//   logCross: -0.85,
//   gradientCorrelation: 0.5,
//   localCoherence: 0.57
// }

// Or compute the features without a verdict
const features = detector.analyseFeatures(imageData);
```

### Gradient Field (for Visualisation)

```typescript
const gradientField = detector.analyseGradients(imageData);

console.log('Gradient dimensions:', gradientField.width, 'x', gradientField.height);
console.log('X-gradient at (10, 10):', gradientField.gx[10][10]);
console.log('Y-gradient at (10, 10):', gradientField.gy[10][10]);
```

`analyseGradients` returns nested arrays, which use a lot of memory for large images. `analyse`
does not build them.

### Low-Level APIs

```typescript
import {
  imageToLuminanceMatrix,
  computeGradients,
  flattenGradientField,
  performPCA,
  computeGradientCoherence,
} from 'alogos';

const luminance = imageToLuminanceMatrix(imageData);
const gradients = computeGradients(luminance);
const pca = performPCA(flattenGradientField(gradients), 2);

console.log('Share of gradient variance on the first component:', pca.explainedVariance[0]);
console.log('Local orientation coherence:', computeGradientCoherence(gradients));
```

## API Reference

### `SyntheticImageDetector`

```typescript
new SyntheticImageDetector(options?: DetectorOptions)
```

Throws a `RangeError` or `TypeError` if an option is invalid.

| Method | Description |
|---|---|
| `analyse(imageData): DetectionResult` | Analyses an image |
| `analyseFeatures(imageData): ImageFeatures` | Returns the features the verdict is based on |
| `analyseGradients(imageData): GradientField` | Returns the gradient field, for visualisation |
| `setOptions(options): void` | Updates options (invalid options throw and leave the current ones unchanged) |
| `getOptions(): Required<DetectorOptions>` | Returns the current options |

`analyse`, `analyseFeatures` and `analyseGradients` throw an `Error` if the image data is
malformed, and `analyse` and `analyseFeatures` throw if the image is smaller than `minImageSize`.

### `detectSyntheticImage(imageData, options?)`

Creates a detector with the given options and analyses one image.

### Types

#### `ImageData`

```typescript
interface ImageData {
  width: number; // integer
  height: number; // integer
  data: Uint8ClampedArray | number[]; // RGBA, 4 values per pixel
}
```

A browser `ImageData` object works as is.

#### `DetectionResult`

```typescript
interface DetectionResult {
  isSynthetic: boolean; // rawScore >= threshold
  confidence: number; // 0 at the threshold, 1 at a rawScore of 0 or 1
  rawScore: number; // probability (0-1) that the image is AI-generated
  metadata: {
    pixelsAnalysed: number;
    primaryVariance: number; // same as features.primaryVariance
    coherence: number; // same as features.localCoherence
    features: ImageFeatures;
  };
}
```

#### `ImageFeatures`

| Feature | Meaning |
|---|---|
| `primaryVariance` | Share of gradient variance along the first principal component (0.5-1) |
| `logKurtosis` | Log kurtosis of gradients projected onto that component (about 1.1 for noise; photos are typically 2-4) |
| `logFineToCoarse` | Gradient energy at full resolution relative to after 2 × 2 averaging (lower = less fine detail) |
| `logResidual` | Energy left after subtracting a 3 × 3 local mean, relative to gradient energy (lower = smoother texture) |
| `logCross` | Mixed-derivative (checkerboard) energy relative to gradient energy |
| `gradientCorrelation` | Correlation between neighbouring gradients (higher = gradients change more smoothly) |
| `localCoherence` | Mean orientation coherence of 8 × 8 blocks (1 = clean edges and lines, 0 = isotropic texture) |

None of the features depends on the image's brightness or contrast.

#### `DetectorOptions`

```typescript
interface DetectorOptions {
  threshold?: number; // Default: 0.5. Must be between 0 and 1 (exclusive)
  minImageSize?: number; // Default: 64. Integer, at least 3
  numComponents?: number; // Deprecated: no effect
  normaliseGradients?: boolean; // Deprecated: no effect on detection
  filterCompressionArtifacts?: boolean; // Deprecated: no effect
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

1. **Luminance**: each pixel is converted to brightness with `L = 0.2126 R + 0.7152 G + 0.0722 B`.
2. **Gradients**: horizontal and vertical brightness changes are measured at every interior pixel
   with central differences, `Gx = [L(x+1, y) − L(x−1, y)] / 2` and `Gy = [L(x, y+1) − L(x, y−1)] / 2`.
   The gradient field is never stored; the statistics are gathered in a few streaming passes.
3. **Features**: seven statistics of the gradient field are computed (see
   [`ImageFeatures`](#imagefeatures)). Two come from principal component analysis of the gradient
   vectors, the idea this library started from; the others measure pixel-level smoothness and the
   local orientation of edges.
4. **Model**: a quadratic logistic regression, fitted on labelled images, converts the features
   into a probability. Its coefficients are in `src/model.ts`, generated by `research/train.py`.

The strongest signal it learned is that images from current generators are **smoother at the
pixel level** than camera photos: they carry less fine-scale energy, and neighbouring gradients
are more strongly correlated.

## Accuracy

Measured on two public datasets: Defactify (MS COCO photos and images from SD 2.1, SDXL, SD 3,
DALL-E 3 and Midjourney) and a sample of CommunityForensics (smartphone photos, landscapes and
COCO photos, and images from community Stable Diffusion models, PixArt and GLIDE). Full details and
per-source results are in [`research/results.md`](research/results.md).

| | Real images correct | AI images correct |
|---|---|---|
| Alogos 1.x scoring | 0% | 100% |
| Sources seen in training (5-fold cross-validation) | 78% | 76% |
| Sources **not** seen in training (leave-one-source-out) | 45% | 67% |

ROC AUC in cross-validation is 0.85.

### How far to trust a score

| rawScore | Share of images | Actually AI-generated |
|---|---|---|
| 0.0 - 0.2 | 21% | 10% |
| 0.2 - 0.4 | 20% | 26% |
| 0.4 - 0.6 | 19% | 53% |
| 0.6 - 0.8 | 17% | 69% |
| 0.8 - 1.0 | 22% | 92% |

Scores between about 0.4 and 0.6 say almost nothing.

## Performance

Median time for one analysis on a 4-core cloud VM with Node.js 22 (`npm run benchmark`):

| Image | Time |
|---|---|
| 256 × 256 | 3 ms |
| 512 × 512 | 9 ms |
| 1024 × 1024 | 37 ms |
| 2048 × 2048 | 147 ms |
| 4032 × 3024 (12 MP phone photo) | 425 ms |

Time grows linearly with the number of pixels. Memory use is about 5 bytes per pixel on top of the
image itself (about 60 MB for a 12-megapixel photo).

## Limitations

- **Unfamiliar sources.** Accuracy drops sharply on cameras, processing pipelines and generators
  that are not in the training data. Before smartphone photos were added to training, every
  smartphone photo in the evaluation set was flagged as AI-generated. Heavily processed photos
  (phone "computational photography", noise reduction, beauty filters) look smooth, like AI
  images.
- **Editing.** Heavy JPEG compression (quality 50) flipped 31% of verdicts, mostly towards "real".
  Halving the image size flipped 24%, mostly towards "AI-generated". Re-saving at high quality
  (95) made almost no difference.
- **Deliberate evasion.** Adding a little noise or sharpening pushes AI-generated images towards
  "real". Anyone trying to evade detection can do so.
- **Image types.** The model was trained on photographs and photo-like generated images.
  Screenshots, illustrations, scans, text and heavily stylised images are outside what it has
  seen, and its answers for them are not meaningful.
- **Size.** Images must be at least 64 × 64 pixels (configurable).

Use Alogos as one signal among many, alongside provenance metadata (such as C2PA), reverse image
search and human judgement.

### JPEG compression

Real photos are usually JPEGs while generated images are often PNGs, and a detector can end up
spotting the file format instead of the content (see "JPEG or Fake?" below). To avoid this, every
Defactify training image, real or generated, is stored as a JPEG of the same quality, and the
CommunityForensics images are used both as stored and re-encoded as JPEG.

## Migrating from 1.x

- `rawScore` is now a calibrated probability from a fitted model, so its values are not
  comparable with 1.x scores. 1.x labelled almost every real photo as synthetic.
- Invalid options now throw (`threshold` must be between 0 and 1, `minImageSize` an integer of at
  least 3, `numComponents` a positive integer). Image width and height must be integers.
- `confidence` is now scaled correctly for thresholds other than 0.5.
- `numComponents`, `normaliseGradients` and `filterCompressionArtifacts` are deprecated and do not
  affect detection. `computePCAScore` and `filterCompressionArtifacts()` are deprecated.
- `metadata.coherence` and `computeGradientCoherence` now measure local orientation coherence
  (0-1) instead of a whole-image sum that was close to 0 for every photo.
- `performPCA` now reports explained variance relative to the total variance, and throws for an
  invalid number of components.
- `imageToluminanceMatrix` is renamed `imageToLuminanceMatrix` (the old name still works).

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub. Run
`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` and `npm run test:package`
before submitting; CI runs the same checks.

To retrain or re-evaluate the model, see [`research/README.md`](research/README.md).

## Licence

MIT. The model coefficients were fitted using datasets with their own licences, one of which is
for non-commercial research only; see [`research/README.md`](research/README.md#data).

## Acknowledgements

Alogos started as an implementation of the gradient field analysis technique for synthetic image
detection shared by [Kavishka Abeywardhana](https://lk.linkedin.com/in/kavishka-abeywardhana-01b891214)
in [this LinkedIn post](https://www.linkedin.com/posts/kavishka-abeywardhana-01b891214_synthetic-image-detection-using-gradient-activity-7397874600769982465-TC0c),
which demonstrated that luminance-gradient PCA reveals differences between real photographs and
diffusion-generated images. The idea of analysing the luminance gradient field, and the PCA
statistics at the heart of it, come from that work. The additional features and the fitted model
were added in 2.0 after evaluating the approach on labelled datasets.

Evaluation and training use the [Defactify](https://huggingface.co/datasets/Rajarshi-Roy-research/Defactify_Image_Dataset)
and [CommunityForensics](https://huggingface.co/datasets/OwensLab/CommunityForensics-Small)
datasets.

## Further Reading

- [JPEG or Fake? Revealing Common Biases in Generated Image Detection Datasets](https://arxiv.org/abs/2308.10395) - how compression can masquerade as a detection signal
- [Community Forensics: Using Thousands of Generators to Train Fake Image Detectors](https://arxiv.org/abs/2411.04125) - why detectors struggle with unseen generators
- [Kavishka Abeywardhana's original post](https://www.linkedin.com/posts/kavishka-abeywardhana-01b891214_synthetic-image-detection-using-gradient-activity-7397874600769982465-TC0c) - the gradient field technique

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
