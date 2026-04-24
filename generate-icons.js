/* ============================================================
   generate-icons.js
   Run this ONCE with Node.js to generate all PWA icon sizes.

   Usage:
     npm install canvas
     node generate-icons.js

   Outputs icons/icon-{size}.png for all required sizes.
============================================================ */

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

SIZES.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  // ── Background ──
  ctx.fillStyle = '#6c63ff';
  // Rounded rectangle
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // ── Emoji / Symbol ──
  const fontSize = Math.round(size * 0.5);
  ctx.font      = `${fontSize}px serif`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📚', size / 2, size / 2 + size * 0.03);

  // Save
  const buffer   = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Generated icon-${size}.png`);
});

console.log('\n🎉 All icons generated in /icons folder!');