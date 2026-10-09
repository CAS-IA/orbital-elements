// Copia la hoja de estilos al paquete publicado (tsup no procesa CSS suelto).
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
copyFileSync('src/styles.css', 'dist/styles.css');
console.log('dist/styles.css copiado');
