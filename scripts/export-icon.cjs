'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'app', 'assets', 'icons', 'lumen-mark.svg');
const outDir = path.join(root, 'build');
const outPng = path.join(outDir, 'icon.png');
const outIco = path.join(outDir, 'icon.ico');

const BG = { r: 12, g: 10, b: 9, alpha: 1 };
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function renderPng(size) {
  return sharp(await fs.promises.readFile(svgPath))
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await sharp(await fs.promises.readFile(svgPath))
    .resize(512, 512, { fit: 'contain', background: BG })
    .png()
    .toFile(outPng);

  const pngBuffers = await Promise.all(ICO_SIZES.map((size) => renderPng(size)));
  const ico = await toIco(pngBuffers);
  await fs.promises.writeFile(outIco, ico);

  console.log('Written', outPng);
  console.log('Written', outIco, `(${ICO_SIZES.join(', ')} px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
