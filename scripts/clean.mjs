// Cross-platform clean (instead of rm -rf).
import { rm } from 'node:fs/promises';
for (const p of ['dist', '.astro', 'cybermove-dist.zip', 'test-results', 'playwright-report']) {
  await rm(p, { recursive: true, force: true });
}
console.log('cleaned');
