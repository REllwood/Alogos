import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';

export default [
  // JavaScript bundles: CommonJS for require(), ES module for import
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
      },
      {
        file: 'dist/index.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
  // Type declarations bundled into a single file per module format
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.d.ts', format: 'es' },
      { file: 'dist/index.d.cts', format: 'es' },
    ],
    plugins: [dts()],
  },
];
