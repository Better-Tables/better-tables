import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(import.meta.dir, '../../ui/src');
const dest = resolve(import.meta.dir, '../ui-src');
if (!existsSync(src)) {
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
