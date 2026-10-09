// Empaqueta la galería en un HTML autocontenido (React por CDN, el resto inline).
// Uso: node scripts/build-gallery.mjs <salida.html>
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'borrador/gallery.html');
const shim = {
  name: 'react-globals',
  setup(b) {
    // react, react-dom/client y el runtime JSX automático → el React 18 global del CDN.
    b.onResolve({ filter: /^react(-dom)?(\/client|\/jsx-runtime|\/jsx-dev-runtime)?$/ }, (a) => ({ path: a.path, namespace: 'g' }));
    b.onLoad({ filter: /.*/, namespace: 'g' }, (a) => ({
      contents: a.path.startsWith('react-dom')
        ? 'module.exports = window.ReactDOM;'
        : a.path.includes('jsx')
          ? 'var R = window.React; function jsx(t, p, k) { var q = Object.assign({}, p); if (k !== undefined) q.key = k; return R.createElement(t, q); } module.exports = { jsx: jsx, jsxs: jsx, jsxDEV: jsx, Fragment: R.Fragment };'
          : 'module.exports = window.React;',
      loader: 'js',
    }));
  },
};
const res = await build({
  entryPoints: ['scripts/gallery-client.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: 'es2020',
  plugins: [shim],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const css = readFileSync('src/styles.css', 'utf8');
const page = readFileSync('scripts/gallery-page.css', 'utf8');
const html = `<title>Orbital Elements</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${page}
${css}
</style>
<div id="app"></div>
<noscript>Esta galería necesita JavaScript para calcular el tema en vivo.</noscript>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
<script>
${js}
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`galería: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
