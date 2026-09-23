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

### Added
- `npm run test:package`: builds the package, loads it via `require()` and `import`, and checks
  the published type declarations.
- `npm run typecheck`, and a `prepublishOnly` guard that runs lint, typecheck, tests and the
  package check before publishing.

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
