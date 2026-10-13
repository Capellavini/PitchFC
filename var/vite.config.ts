import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.VAR_BASE || '/', build: { outDir: 'dist' } });
