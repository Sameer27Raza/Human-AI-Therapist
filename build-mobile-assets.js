const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// --- Static web assets ---
const filesToCopy = [
  'index.html',
  'manifest.json',
  'sw.js',
  'script.js',
  'therapist-portrait.jpg',
  'haven-mark.png',
  'mode2.css',
  'mode3.css',
  'notes-reader.css',
  'notes-gesture-reader.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'title1.svg',
  'title2.svg',
  'title3.svg',
  'title4.svg'
];

filesToCopy.forEach((file) => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} -> www/`);
  }
});

// --- Documents (PDFs + notes-pages images) ---
const documentsSrc = path.join(srcDir, 'documents');
const documentsDest = path.join(destDir, 'documents');
if (fs.existsSync(documentsSrc)) {
  fs.cpSync(documentsSrc, documentsDest, { recursive: true });
  console.log('Copied documents/ -> www/documents/');
}

// --- PDF.js library ---
const libSrc = path.join(srcDir, 'lib');
const libDest = path.join(destDir, 'lib');
if (fs.existsSync(libSrc)) {
  fs.cpSync(libSrc, libDest, { recursive: true });
  console.log('Copied lib/ -> www/lib/');
}

// --- Android assets (only if native build is present) ---
const androidAssets = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public');
if (fs.existsSync(androidAssets)) {
  fs.cpSync(destDir, androidAssets, { recursive: true });
  console.log('Synced www/ -> android assets/public/');
}

// --- Desktop app assets (only if Electron build is present) ---
const desktopAppDir = path.join(__dirname, 'dist-desktop', 'Human AI Therapist-win32-x64', 'resources', 'app');
if (fs.existsSync(desktopAppDir)) {
  filesToCopy.forEach((file) => {
    const src = path.join(srcDir, file);
    const dest = path.join(desktopAppDir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  });
  if (fs.existsSync(documentsSrc)) {
    fs.cpSync(documentsSrc, path.join(desktopAppDir, 'documents'), { recursive: true });
  }
  if (fs.existsSync(libSrc)) {
    fs.cpSync(libSrc, path.join(desktopAppDir, 'lib'), { recursive: true });
  }
  console.log('Synced files -> dist-desktop resources/app/');
}

console.log('Mobile assets preparation complete!');
