import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/netbeans/',plugins:[react()],build:{outDir:'../dist/netbeans',emptyOutDir:true,chunkSizeWarningLimit:2300}});
