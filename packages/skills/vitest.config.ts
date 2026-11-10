import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Mirrors Vite's `?raw` import so the skill text loads in tests too.
export default defineConfig({
  plugins: [
    {
      name: 'raw',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('?raw')) {
          return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), 'utf8'))};`;
        }
      },
    },
  ],
});
