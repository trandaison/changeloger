import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
// import terser from '@rollup/plugin-terser';

const config = [
  {
    input: 'src/main.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'commonjs',
      },
      {
        file: 'dist/index.mjs',
        format: 'es',
      },
    ],
    plugins: [typescript(), nodeResolve(), commonjs()],
  },
  {
    input: 'src/bin/changeloger.ts',
    output: {
      file: 'dist/cli.mjs',
      format: 'es',
      inlineDynamicImports: true,
    },
    plugins: [typescript(), nodeResolve()],
  },
  {
    input: 'src/types.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];

export default config;
