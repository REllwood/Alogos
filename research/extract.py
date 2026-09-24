"""Extract detector features from the evaluation datasets.

Usage (after running download.sh):

    python extract.py defactify data/defactify/*.parquet --out data/defactify.csv
    python extract.py communityforensics data/communityforensics/*.parquet --out data/cf.csv
    python extract.py robustness data/defactify/test-00000-of-00008.parquet \
        --out data/robustness.csv --limit 1200

Each row of the output is one image (or one edited copy of an image) with the
features from features.py and its label and source.
"""
import argparse
import base64
import io
import multiprocessing as mp

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

import features as F

DEFACTIFY_SOURCES = {0: 'Defactify real (COCO)', 1: 'SD 2.1', 2: 'SDXL', 3: 'SD 3',
                     4: 'DALL-E 3', 5: 'Midjourney'}

# CommunityForensics-Small shards used, and how many images to take from each
CF_SHARDS = {
    115: ('real', 'CF real (smartphone, VISION)', 200),
    160: ('real', 'CF real (LandscapesHQ)', 200),
    117: ('real', 'CF real (COCO)', 200),
    7: ('fake', 'CF Stable Diffusion community models (a)', 150),
    52: ('fake', 'CF Stable Diffusion community models (b)', 150),
    10: ('fake', 'CF PixArt and community models', 150),
    82: ('fake', 'CF GLIDE (pixel-space diffusion)', 150),
}


def decode(raw):
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))


def jpeg(rgb, quality):
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, 'JPEG', quality=quality)
    buf.seek(0)
    return np.asarray(Image.open(buf).convert('RGB'))


def edit(rgb, kind):
    """Everyday edits used to measure robustness."""
    if kind == 'none':
        return rgb
    if kind.startswith('jpeg'):
        return jpeg(rgb, int(kind[4:]))
    if kind.startswith('resize'):
        scale = float(kind[6:])
        im = Image.fromarray(rgb)
        w, h = im.size
        return np.asarray(im.resize((max(8, round(w * scale)), max(8, round(h * scale))), Image.LANCZOS))
    if kind.startswith('crop'):  # a small crop moves the JPEG 8 x 8 grid off the image origin
        offset = int(kind[4:])
        return rgb[offset:, offset:]
    raise ValueError(kind)


def centre_crop(rgb, size=1024):
    """Per-pixel statistics are unchanged by cropping, so large photos are cropped to save time."""
    h, w = rgb.shape[:2]
    top, left = max(0, (h - size) // 2), max(0, (w - size) // 2)
    return rgb[top:top + size, left:left + size]


def rows_for(rgb, meta, variants):
    out = []
    for variant, image in variants(rgb):
        L = F.luminance(image)
        for mask in (False, True):
            row = F.features(L, mask)
            row.update(meta)
            row.update({'variant': variant, 'mask': mask, 'width': L.shape[1], 'height': L.shape[0]})
            out.append(row)
    return out


def defactify_job(args):
    raw, meta = args
    return rows_for(decode(raw), meta, lambda rgb: [('none', rgb)])


def robustness_job(args):
    raw, meta = args
    kinds = ['none', 'jpeg95', 'jpeg50', 'resize0.5', 'crop3']
    return rows_for(decode(raw), meta, lambda rgb: [(k, edit(rgb, k)) for k in kinds])


def cf_job(args):
    raw, meta = args
    rgb = centre_crop(decode(raw))
    # As stored (generated images are PNG), and re-encoded like the Defactify images (JPEG q75)
    return rows_for(rgb, meta, lambda rgb: [('as-stored', rgb), ('jpeg75', jpeg(rgb, 75))])


def load_defactify(files, limit):
    rows = []
    for fn in files:
        t = pq.read_table(fn, columns=['Image', 'Label_B'])
        for image, label_b in zip(t.column('Image').to_pylist(), t.column('Label_B').to_pylist()):
            rows.append((image['bytes'], {'label': int(label_b > 0), 'source': DEFACTIFY_SOURCES[label_b],
                                          'dataset': 'defactify', 'image_id': f'{fn}#{len(rows)}'}))
    if limit:
        order = np.random.default_rng(0).permutation(len(rows))[:limit]
        rows = [rows[i] for i in order]
    return rows


def load_cf(files):
    rows = []
    for fn in files:
        shard = int(fn.rsplit('_', 1)[-1].split('.')[0])
        if shard not in CF_SHARDS:
            continue
        label, source, wanted = CF_SHARDS[shard]
        pf = pq.ParquetFile(fn, memory_map=True)
        taken = 0
        for batch in pf.iter_batches(batch_size=16, columns=['image_data', 'model_name']):
            for image, model in zip(batch.column('image_data').to_pylist(), batch.column('model_name').to_pylist()):
                raw = image if isinstance(image, (bytes, bytearray)) else base64.b64decode(image)
                rows.append((bytes(raw), {'label': int(label == 'fake'), 'source': source, 'model': model,
                                          'dataset': 'communityforensics', 'image_id': f'{shard}#{taken}'}))
                taken += 1
                if taken >= wanted:
                    break
            if taken >= wanted:
                break
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('dataset', choices=['defactify', 'communityforensics', 'robustness'])
    parser.add_argument('files', nargs='+')
    parser.add_argument('--out', required=True)
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()

    if args.dataset == 'communityforensics':
        rows, job = load_cf(args.files), cf_job
    else:
        rows = load_defactify(args.files, args.limit)
        job = defactify_job if args.dataset == 'defactify' else robustness_job

    with mp.Pool() as pool:
        results = pool.map(job, rows, chunksize=8)
    pd.DataFrame([r for rs in results for r in rs]).to_csv(args.out, index=False)
    print(f'{args.out}: {len(rows)} images')


if __name__ == '__main__':
    main()
