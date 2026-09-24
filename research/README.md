# Research: how the detector was built and how well it works

This folder holds everything needed to reproduce the model in `src/model.ts` and the
accuracy figures quoted in the main README. It is not part of the npm package.

Full, generated results are in [results.md](results.md).

## Summary

- The scoring formula shipped in Alogos 1.0.0 labelled **every** real photo in the evaluation
  data as AI-generated. Its kurtosis term assumed real photos have Gaussian-like gradients, but
  real photos have heavy-tailed gradients (mostly smooth areas broken by sharp edges), so the
  score saturated at 1.
- On their own, the two original PCA statistics (primary variance and projection kurtosis) barely
  separate real from AI-generated images (ROC AUC about 0.54).
- The strongest cue is the reverse of the original hypothesis: images from these generators are
  **smoother at the pixel level** than camera photos (less fine-scale energy, more strongly
  correlated neighbouring gradients), rather than full of unstable high-frequency detail.
- A small quadratic logistic model on seven gradient features gets about **77% balanced
  accuracy** (ROC AUC 0.85) on sources represented in its training data, and is well calibrated:
  scores above 0.8 were AI-generated 92% of the time; scores below 0.2, 10% of the time.
- On sources it has **not** seen it is much weaker (about 45% of real and 67% of AI-generated
  images correct on average). Real photos from a smartphone collection were all flagged as
  AI-generated until smartphone photos were added to the training data.
- Heavy JPEG compression and resizing shift scores substantially (about a quarter to a third of
  verdicts flip).

The detector is therefore a weak, interpretable signal. It should never be used on its own to
decide whether an image is real.

## Features

All seven features come from central-difference gradients of the luminance plane
(`L = 0.2126 R + 0.7152 G + 0.0722 B`) at interior pixels. Each is a ratio, correlation or
normalised moment, so none depends on brightness or contrast.

| Feature | What it measures |
|---|---|
| `primaryVariance` | Share of gradient variance along the first principal component (the original PCA idea) |
| `logKurtosis` | Log kurtosis of gradients projected onto that component (heavy tails = sharp edges on smooth areas) |
| `logFineToCoarse` | Gradient energy at full resolution relative to after 2 × 2 averaging |
| `logResidual` | Energy left after subtracting a 3 × 3 local mean, relative to gradient energy |
| `logCross` | Mixed-derivative (checkerboard) energy relative to gradient energy |
| `gradientCorrelation` | Correlation between neighbouring gradients along each axis |
| `localCoherence` | Mean structure-tensor orientation coherence of 8 × 8 blocks |

`features.py` is the reference implementation. `src/features.ts` reproduces it to within about
1e-7 on real photos, and the test suite checks both against shared fixtures.

## Data

| Dataset | Used | Real images | AI-generated images | Licence |
|---|---|---|---|---|
| [Defactify](https://huggingface.co/datasets/Rajarshi-Roy-research/Defactify_Image_Dataset) (validation split and first test shard) | Training and evaluation | MS COCO photos | SD 2.1, SDXL, SD 3, DALL-E 3, Midjourney, generated from the same captions | Not stated on the dataset card |
| [CommunityForensics-Small](https://huggingface.co/datasets/OwensLab/CommunityForensics-Small) (seven shards, sampled) | Training and evaluation | Smartphone photos (VISION), LandscapesHQ, COCO | Community Stable Diffusion fine-tunes, PixArt, GLIDE | CC BY-NC-SA 4.0 (non-commercial research) |

Every Defactify image is stored as a JPEG at quality 75, so image format cannot give the answer
away. CommunityForensics images are evaluated both as stored (generated images are PNG) and
re-encoded to match.

**Licensing note.** The model coefficients in `src/model.ts` were fitted using both datasets,
one of which is licensed for non-commercial research only. Whether a handful of fitted
coefficients is a derivative of the training images is unsettled; if that matters for your use,
seek advice or retrain on data you are licensed to use (the scripts here make that
straightforward). No images or per-image feature tables are included in this repository.

## Protocol

- Sources are weighted equally within each class, and the two classes equally, so the default
  threshold of 0.5 corresponds to even odds.
- **Cross-validation** uses five folds grouped by image, so an image and its re-encoded copy never
  appear on both sides.
- **Leave-one-source-out** trains on every source but one and tests on the one left out. This is
  the best estimate of behaviour on cameras, editing pipelines and generators not in the data.
- **Robustness** trains without the Defactify test shard, then scores 1,200 of its images before
  and after common edits.

The Defactify test shard's AI-generated images look deliberately perturbed (they carry more
high-frequency energy than the validation split, while its real images match exactly). That
matters: light noise or sharpening pushes AI-generated images towards "real", a basic weakness
of any detector built on pixel statistics.

## Reproducing

```bash
cd research
python -m pip install -r requirements.txt
./download.sh                     # about 9 GB into research/data/
python extract.py defactify data/defactify/*.parquet --out data/defactify.csv
python extract.py communityforensics data/communityforensics/*.parquet --out data/cf.csv
python extract.py robustness data/defactify/test-00000-of-00008.parquet \
    --out data/robustness.csv --limit 1200
python train.py                   # writes results.md, ../src/model.ts, ../src/__fixtures__/reference.json
```

Then run `npm test` from the repository root: the fixture tests confirm that the TypeScript
features and probabilities still match the Python reference.
