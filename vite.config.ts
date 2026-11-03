import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId = `${(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('baserow'),
    __BUILD_ID__: JSON.stringify(buildId),
    'import.meta.env.VITE_SHOW_DIAGNOSTICS': JSON.stringify('false'),
  },
});
