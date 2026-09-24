import { luminancePlane } from './analysis';
import { imageToLuminanceMatrix } from './luminance';
import { ImageData } from './types';

describe('luminancePlane', () => {
  it('should compute the same luminance as imageToLuminanceMatrix', () => {
    const width = 37;
    const height = 23;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i++) data[i] = (i * 97) % 256;
    const image: ImageData = { width, height, data };

    const plane = luminancePlane(image);
    const expected = imageToLuminanceMatrix(image);

    expect(plane.width).toBe(width);
    expect(plane.height).toBe(height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        expect(plane.data[y * width + x]).toBeCloseTo(expected[y][x], 3);
      }
    }
  });

  it('should accept plain number arrays', () => {
    const plane = luminancePlane({ width: 1, height: 1, data: [255, 255, 255, 0] });
    expect(plane.data[0]).toBeCloseTo(255, 3);
  });
});
