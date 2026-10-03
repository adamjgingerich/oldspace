import { defineConfig } from 'vite';

// Relative asset paths so the production build works from any subpath —
// e.g. https://<user>.github.io/oldspace/ on GitHub Pages.
export default defineConfig({
  base: './',
});
