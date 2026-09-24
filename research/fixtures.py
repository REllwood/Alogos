"""Deterministic test images shared by the Python reference and the TypeScript tests.

The images use integer arithmetic only, so both languages generate identical
pixels. `src/features.test.ts` rebuilds them and checks that the TypeScript
features and probability match the values train.py writes to
`src/__fixtures__/reference.json`.
"""
import numpy as np


def _hash(x, y, c):
    return ((x * 73856093) ^ (y * 19349663) ^ (c * 83492791)) & 0xFFFF


def _value(kind, x, y, c):
    h = _hash(x, y, c)
    if kind == 'textured':
        v = (x * 3 + y * 5) % 97 + ((x * y) >> 5) % 61 + h % 37 + (60 if x > 40 and y < 50 else 0)
    elif kind == 'smooth':
        v = ((x * x + y * y) >> 4) % 256 + h % 3
    elif kind == 'stripes':
        v = ((x >> 2) % 2) * 200 + h % 5
    else:
        raise ValueError(kind)
    return min(255, max(0, v))


FIXTURES = {'textured': (96, 80), 'smooth': (64, 64), 'stripes': (72, 72)}


def fixture_rgb(kind):
    width, height = FIXTURES[kind]
    rgb = np.zeros((height, width, 3), np.uint8)
    for y in range(height):
        for x in range(width):
            for c in range(3):
                rgb[y, x, c] = _value(kind, x, y, c)
    return rgb
