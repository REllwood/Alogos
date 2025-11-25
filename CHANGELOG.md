# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Planned
- WebAssembly acceleration for large images
- Additional statistical metrics
- Model-specific detection improvements
- CLI tool for batch processing
- Image preprocessing utilities
- Visualisation tools for gradient fields

