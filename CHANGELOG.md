# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- The published package could not be loaded in Node.js: `import 'alogos'` threw
  `exports is not defined in ES module scope` and `require('alogos')` returned an empty object.
  The build now emits `dist/index.cjs` and `dist/index.mjs` with an `exports` map and
  bundled type declarations for both module formats (verified with `attw`).
- `npm run lint` failed because the ESLint config was written as an ES module; it is now
  `.eslintrc.cjs`.
- PCA used randomly seeded power iteration, so results could differ between runs on the same
  image and could report a primary variance below 0.5 (impossible for 2-D data). It now uses
  a deterministic Jacobi eigendecomposition that is exact to machine precision.
- `explainedVariance` was divided by the sum of the *computed* eigenvalues only, so asking for
  one component always reported 100%. It is now relative to the total variance of the data,
  and `totalVariance` is the trace of the covariance matrix.
- `performPCA` centred the data twice; it now centres once.
- `performPCA` now throws a `RangeError` for a `numComponents` that is not a positive integer
  (previously `0` silently produced an empty result). Values above the data dimension are capped.
- `confidence` was `|rawScore - threshold| / threshold`, which only reached 1 on both sides when
  the threshold was 0.5 (at a threshold of 0.9 the strongest possible "synthetic" result showed
  0.11 confidence) and was `NaN` for a threshold of 0. Confidence is now the distance from the
  threshold divided by the distance to the relevant end of the range, so it runs from 0 at the
  threshold to 1 at either extreme for any threshold.
- Detector options are now validated when the detector is created and in `setOptions()`:
  `threshold` must be strictly between 0 and 1, `numComponents` a positive integer,
  `minImageSize` an integer of at least 3, and the flags booleans. Invalid values throw a
  `RangeError` or `TypeError` instead of silently producing meaningless results, and a failed
  `setOptions()` leaves the existing options unchanged. Options passed as `undefined` fall back
  to their defaults.
- Image width and height must now be integers.
- Analysis was slow and memory-hungry because every intermediate step (luminance, filtered and
  normalised copies, gradients, an N × 2 matrix of per-pixel arrays and two centred copies of it)
  was materialised as nested JavaScript arrays. The detector now keeps luminance in a single
  `Float32Array` and computes gradients on the fly in two streaming passes. Results are
  unchanged (covered by parity tests against the public helpers). Measured on a 4-core cloud
  VM with Node 22:

  | Image | Before | After |
  |---|---|---|
  | 1024 × 1024 | 931 ms, 380 MB peak RSS | 35 ms, 70 MB |
  | 4032 × 3024 (12 MP phone photo) | 24.3 s, 3.5 GB | 0.42 s, 240 MB |
- `coherence` (in `metadata` and `computeGradientCoherence`) was the length of the summed
  gradient vectors divided by the summed magnitudes. Over a whole image that sum telescopes to
  the difference between the border pixels, so it said almost nothing about the image and was
  close to 0 for every photo. It is now the standard orientation coherence of the structure
  tensor, (λ1 − λ2) / (λ1 + λ2), averaged over 8 × 8 blocks: 1 where gradients share one
  orientation (clean edges and lines), 0 for isotropic texture or noise. Opposite gradients on
  either side of a line now count as the same orientation. `computeGradientCoherence` takes an
  optional block size.
- `analyseGradients()` skipped the compression filter that `analyse()` applies, so it did not
  return the gradients the detector actually measured. It now uses the same preprocessing.

### Deprecated
- `numComponents`: gradients are 2-D vectors, so there are only ever two principal components and
  the detector only uses the first. The option is still validated but has no effect.
- `normaliseGradients`: every statistic the detector uses is unchanged by rescaling brightness,
  so this never affected detection. It still scales the field returned by `analyseGradients()`.

### Added
- `imageToLuminanceMatrix`, the correctly cased name for `imageToluminanceMatrix`. The old name
  still works but is deprecated.
- A test that keeps the exported `VERSION` in sync with `package.json`.
- `npm run benchmark`: times the detector on a range of image sizes.
- `npm run test:package`: builds the package, loads it via `require()` and `import`, and checks
  the published type declarations.
- `npm run typecheck`, and a `prepublishOnly` guard that runs lint, typecheck, tests and the
  package check before publishing.

### Changed
- LICENCE: filled in the copyright line (it still had a `[Rhys E]` placeholder and no year) and
  restored "sublicense" (the verb; "licence" is only the noun in Australian English).

### Removed
- Redundant `.npmignore` (the `files` field in `package.json` already controls the tarball) and
  unused Rollup plugins.

### Planned
- WebAssembly acceleration for large images
- Additional statistical metrics
- Model-specific detection improvements
- CLI tool for batch processing
- Image preprocessing utilities
- Visualisation tools for gradient fields

## [1.0.0] - 2025-01-01

### Acknowledgements
This library implements the gradient field analysis technique discovered by Kavishka Abeywardhana. See README.md for full attribution.

### Added
- Initial release of Alogos
- RGB to luminance conversion using photometric formula
- Spatial gradient computation using central differences
- PCA-based analysis of gradient fields
- Covariance matrix computation
- Synthetic image detection algorithm
- `SyntheticImageDetector` class with configurable options
- `detectSyntheticImage` convenience function
- Comprehensive TypeScript type definitions
- Full test coverage with Jest
- Detailed documentation and examples
- Browser and Node.js support
- Australian English spelling throughout

### Features
- Lightweight gradient field analysis
- No external dependencies
- Fast performance (O(n) complexity)
- Interpretable results with confidence scores
- Detailed metadata (coherence, variance, etc.)
- Configurable thresholds and parameters
- Support for custom image preprocessing
