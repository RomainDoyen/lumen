'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Injecte build/icon.ico dans Lumen.exe après le pack Windows.
 * Nécessaire quand signAndEditExecutable est false (contournement winCodeSign / symlinks).
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const root = path.join(__dirname, '..');
  const iconPath = path.join(root, 'build', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    throw new Error(
      'build/icon.ico introuvable — exécutez "npm run icons" avant "npm run dist".'
    );
  }

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  if (!fs.existsSync(exePath)) {
    throw new Error(`Exécutable introuvable : ${exePath}`);
  }

  const rcedit = require('rcedit');
  await rcedit(exePath, { icon: iconPath });
  console.log(`[after-pack-icon] Icône appliquée sur ${exePath}`);
};
