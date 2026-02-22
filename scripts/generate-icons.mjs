#!/usr/bin/env node
/**
 * Generates extension PNG icons from the website/icon.svg file.
 * Run once after any logo change:   node scripts/generate-icons.mjs
 *
 * Requires: npm install --save-dev sharp
 */
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('❌  sharp is not installed. Run:  npm install --save-dev sharp');
  process.exit(1);
}

const svgPath = join(root, 'website', 'icon.svg');
const outDir  = join(root, 'public', 'icon');
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);
const sizes = [16, 32, 48, 96, 128];

for (const size of sizes) {
  const out = join(outDir, `${size}.png`);
  await sharp(svg).resize(size, size).png({ quality: 100 }).toFile(out);
  console.log(`✔  ${size}x${size}  →  ${out}`);
}

console.log('\n✅  All icons generated. Run  npm run build  to rebuild the extension.');
