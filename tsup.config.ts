import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'brand/index': 'src/brand/index.ts',
    'catalog/index': 'src/catalog/index.ts',
    'tools/index': 'src/tools/index.ts',
    'react/index': 'src/react/index.ts',
    'json-render/index': 'src/json-render/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  external: ['react', 'react-dom', '@json-render/core', '@json-render/react'],
});
