#!/usr/bin/env bash
# Downloads the dataset shards used to train and evaluate the detector (about 9 GB).
# See README.md for the licences that apply to each dataset.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data/defactify data/communityforensics

DEFACTIFY=https://huggingface.co/datasets/Rajarshi-Roy-research/Defactify_Image_Dataset/resolve/main/data
for f in validation-00000-of-00002 validation-00001-of-00002 test-00000-of-00008; do
  curl -fL --retry 3 -o "data/defactify/$f.parquet" "$DEFACTIFY/$f.parquet"
done

CF=https://huggingface.co/datasets/OwensLab/CommunityForensics-Small/resolve/main/data
for shard in 115 160 117 7 52 10 82; do
  curl -fL --retry 3 -o "data/communityforensics/HFCF_small_$shard.parquet" "$CF/HFCF_small_$shard.parquet"
done
