'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'icons', 'lumen-mark.svg');
const outDir = path.join(root, 'build');
const outPng = path.join(outDir, 'icon.png');

async function main() {
  const svg = fs.readFileSync(svgPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await sharp(svg)
    .resize(512, 512, { fit: 'contain', background: { r: 12, g: 10, b: 9, alpha: 1 } })
    .png()
    .toFile(outPng);
  console.log('Written', outPng);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
