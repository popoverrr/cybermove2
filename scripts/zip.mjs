// Packs the CONTENTS of dist/ (at the zip root, including .htaccess) into cybermove-dist.zip for Plesk upload.
import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const dist = join(process.cwd(), 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ is missing — run `npm run build` first.');
  process.exit(1);
}
const zip = new AdmZip();
zip.addLocalFolder(dist, '');
const out = join(process.cwd(), 'cybermove-dist.zip');
zip.writeZip(out);
console.log(`Written ${out} (${zip.getEntries().length} files)`);
