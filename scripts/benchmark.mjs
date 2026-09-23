/**
 * Measures analysis time for a range of image sizes using the built package.
 *
 * Run with `npm run benchmark` (which builds first). Pass sizes as WIDTHxHEIGHT
 * arguments to override the defaults, e.g. `npm run benchmark -- 800x600`.
 */
import { performance } from 'node:perf_hooks';
import { SyntheticImageDetector } from '../dist/index.mjs';

const sizes = (
  process.argv.length > 2
    ? process.argv.slice(2)
    : ['256x256', '512x512', '1024x1024', '2048x2048', '4032x3024']
).map((s) => s.split('x').map(Number));

function makeImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 12345;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = seed & 0xff;
  }
  return { width, height, data };
}

const detector = new SyntheticImageDetector();
detector.analyse(makeImage(128, 128)); // warm up

console.log('size         megapixels  median ms  (5 runs)');
for (const [width, height] of sizes) {
  const image = makeImage(width, height);
  const times = [];
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    detector.analyse(image);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(
    `${`${width}x${height}`.padEnd(12)} ${((width * height) / 1e6).toFixed(1).padStart(10)}  ${times[2]
      .toFixed(0)
      .padStart(9)}`
  );
}
