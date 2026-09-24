"""Reference implementation of the detector's gradient-field features.

This is the implementation the model in src/model.ts was trained on. The
TypeScript version in src/features.ts must produce the same values (the test
suite checks this on fixed fixtures; on real photos the two agree to ~1e-7).

All features are computed from the luminance plane L (H x W, values 0-255)
using central-difference gradients at interior pixels.

`mask=True` drops every sample whose finite-difference stencil straddles an
8 x 8 JPEG block boundary. It is kept only to reproduce the experiment showing
that this does not help (see README.md); the detector does not use it.
"""
import io
import numpy as np
from PIL import Image

FEATURES = ['pv', 'log_kurtosis', 'log_fine_coarse', 'log_residual', 'log_cross',
            'gradient_lag_corr', 'local_coherence']

def luminance(rgb):
    rgb = rgb.astype(np.float64)
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

def allowed(n, period, mask):
    """Boolean vector: index i usable as a central-difference centre."""
    ok = np.zeros(n, bool); ok[1:n - 1] = True
    if mask:
        i = np.arange(n); ok &= (i % period != 0) & (i % period != period - 1)
    return ok

def features(L, mask=False):
    H, W = L.shape
    ax, ay = allowed(W, 8, mask), allowed(H, 8, mask)
    sel = np.ix_(ay, ax)
    gx_full = np.zeros_like(L); gy_full = np.zeros_like(L)
    gx_full[:, 1:-1] = (L[:, 2:] - L[:, :-2]) / 2
    gy_full[1:-1, :] = (L[2:, :] - L[:-2, :]) / 2
    gx, gy = gx_full[sel], gy_full[sel]
    x, y = gx.ravel(), gy.ravel(); n = x.size
    mx, my = x.mean(), y.mean()
    cxx = (x * x).mean() - mx * mx; cyy = (y * y).mean() - my * my; cxy = (x * y).mean() - mx * my
    tr = cxx + cyy
    disc = np.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2)
    l1 = tr / 2 + disc
    f = {}
    f['pv'] = l1 / tr if tr > 0 else 0.5
    # principal direction
    if abs(cxy) > 0:
        v = np.array([l1 - cyy, cxy])
    else:
        v = np.array([1.0, 0.0]) if cxx >= cyy else np.array([0.0, 1.0])
    v = v / np.linalg.norm(v)
    p = (x - mx) * v[0] + (y - my) * v[1]
    m2 = (p * p).mean(); m4 = (p ** 4).mean()
    f['log_kurtosis'] = np.log(m4 / (m2 * m2)) if m2 > 0 else 0.0
    E1 = (x * x + y * y).mean()
    # residual: L minus 3x3 mean at the same centres
    box = np.zeros_like(L)
    box[1:-1, 1:-1] = sum(L[1 + dy:H - 1 + dy, 1 + dx:W - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    r = (L - box)[sel]
    Er = (r * r).mean()
    f['log_residual'] = np.log((Er + 1e-12) / (E1 + 1e-12))
    # cross derivative on 2x2 cells; with mask, skip cells straddling a block boundary
    d = L[:-1, :-1] - L[:-1, 1:] - L[1:, :-1] + L[1:, 1:]
    cx = np.ones(W - 1, bool); cy = np.ones(H - 1, bool)
    if mask:
        cx = (np.arange(W - 1) % 8) != 7; cy = (np.arange(H - 1) % 8) != 7
    dd = d[np.ix_(cy, cx)]
    f['log_cross'] = np.log(((dd * dd).mean() + 1e-12) / (E1 + 1e-12))
    # lag-1 correlation of gx along x and gy along y (pairs of usable centres)
    def lagcorr(a, b):
        a = a - a.mean(); b = b - b.mean(); den = np.sqrt((a * a).mean() * (b * b).mean())
        return (a * b).mean() / den if den > 0 else 0.0
    px = ax[:-1] & ax[1:]; py = ay[:-1] & ay[1:]
    cxr = lagcorr(gx_full[ay][:, :-1][:, px].ravel(), gx_full[ay][:, 1:][:, px].ravel())
    cyr = lagcorr(gy_full[:, ax][:-1][py].ravel(), gy_full[:, ax][1:][py].ravel())
    f['gradient_lag_corr'] = (cxr + cyr) / 2
    # fine-to-coarse gradient energy (2x2 mean pooling, grid period 4 in the pooled plane)
    h2, w2 = H // 2, W // 2
    L2 = L[:2 * h2, :2 * w2].reshape(h2, 2, w2, 2).mean(axis=(1, 3))
    a2x, a2y = allowed(w2, 4, mask), allowed(h2, 4, mask)
    g2x = (L2[:, 2:] - L2[:, :-2]) / 2; g2y = (L2[2:, :] - L2[:-2, :]) / 2
    g2x = g2x[a2y][:, a2x[1:-1]]; g2y = g2y[a2y[1:-1]][:, a2x]
    E2 = (g2x * g2x).mean() + (g2y * g2y).mean()
    f['log_fine_coarse'] = np.log((E1 + 1e-12) / (E2 + 1e-12))
    # local structure-tensor coherence on 8x8 blocks aligned with the origin
    usable = np.zeros((H, W), bool); usable[sel] = True
    hb, wb = H // 8, W // 8
    def blocksum(A):
        return (A * usable)[:hb * 8, :wb * 8].reshape(hb, 8, wb, 8).sum(axis=(1, 3))
    Jxx, Jyy, Jxy = blocksum(gx_full ** 2), blocksum(gy_full ** 2), blocksum(gx_full * gy_full)
    T = Jxx + Jyy
    ok = T > 1e-9
    coh = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2)[ok] / T[ok]
    f['local_coherence'] = coh.mean() if coh.size else 0.0
    return f

def decode(img_bytes):
    return np.asarray(Image.open(io.BytesIO(img_bytes)).convert('RGB'))

def transform(rgb, kind):
    if kind == 'none':
        return rgb
    im = Image.fromarray(rgb)
    if kind.startswith('jpeg'):
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=int(kind[4:])); buf.seek(0)
        return np.asarray(Image.open(buf).convert('RGB'))
    if kind.startswith('resize'):
        s = float(kind[6:]); w, h = im.size
        return np.asarray(im.resize((max(8, round(w * s)), max(8, round(h * s))), Image.LANCZOS))
    if kind.startswith('crop'):  # crop that breaks JPEG grid alignment
        o = int(kind[4:]); return rgb[o:, o:]
    raise ValueError(kind)
