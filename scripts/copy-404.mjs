// Post-build step for the GitHub Pages SPA. Pages serves 404.html for any path
// it can't find as a static file (e.g. deep links like /WorkOutAppRefactor/profile
// or /build). Copying the BUILT index.html to 404.html means that fallback boots
// the same hashed app bundle, and the client router then resolves the path.
import { copyFileSync, existsSync } from 'node:fs';

const src = 'dist/index.html';
const dest = 'dist/404.html';

if (!existsSync(src)) {
  console.error(`[copy-404] ${src} not found — run \`vite build\` first.`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`[copy-404] ${src} -> ${dest} (SPA deep-link fallback)`);
