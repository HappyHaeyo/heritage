import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // Keep the local dev URL; production and preview use the repository subpath.
  base: command === 'build' || isPreview ? '/heritage/' : '/',
}));
