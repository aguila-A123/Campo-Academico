import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/pseint/',plugins:[react()],build:{outDir:'../dist/pseint',emptyOutDir:true,chunkSizeWarningLimit:1400}});
