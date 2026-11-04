import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // relative, so it works under github.io/daywell/
  plugins: [react()],
  test: { environment: 'node' },
});
