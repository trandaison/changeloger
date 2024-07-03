import typescript from '@rollup/plugin-typescript';
// import dts from 'rollup-plugin-dts';

const config = [
  {
    input: 'src/main.ts',
    output: {
      file: 'dist/main.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [typescript()],
  },
  // {
  //   input: 'src/types.d.ts',
  //   output: {
  //     file: 'dist.d.ts',
  //     format: 'es',
  //   },
  //   plugins: [dts()],
  // },
];

export default config;
