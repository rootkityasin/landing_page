const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function resizeOptimal() {
  const images = [
    { file: 'public/uploads/media-1787690411261-932816281.webp', maxW: 580, q: 72 },
    { file: 'public/uploads/media-1787682554429-21106470.webp', maxW: 650, q: 75 },
    { file: 'public/uploads/media-1787681478748-918889863.webp', maxW: 600, q: 75 },
    { file: 'public/uploads/media-1787681854644-265275869.webp', maxW: 600, q: 75 },
    { file: 'public/uploads/media-1787681475090-937220178.webp', maxW: 600, q: 75 },
    { file: 'public/uploads/media-1787682523203-498536091.webp', maxW: 650, q: 75 },
    { file: 'public/uploads/post1.webp', maxW: 650, q: 75 },
    { file: 'public/uploads/post2.webp', maxW: 650, q: 75 },
    { file: 'public/images/post1.webp', maxW: 650, q: 75 },
    { file: 'public/images/post2.webp', maxW: 650, q: 75 },
    { file: 'public/images/polygons_logo.webp', maxW: 300, q: 80 }
  ];

  for (const item of images) {
    if (!fs.existsSync(item.file)) continue;
    const buf = fs.readFileSync(item.file);
    const meta = await sharp(buf).metadata();
    
    const newWidth = Math.min(meta.width, item.maxW);
    const optimized = await sharp(buf)
      .resize({ width: newWidth, withoutEnlargement: true })
      .webp({ quality: item.q, effort: 6, smartSubsample: true })
      .toBuffer();

    fs.writeFileSync(item.file, optimized);
    const updatedMeta = await sharp(optimized).metadata();
    console.log(`✅ [${path.basename(item.file)}]: ${(buf.length/1024).toFixed(1)} KB -> ${(optimized.length/1024).toFixed(1)} KB (${updatedMeta.width}x${updatedMeta.height})`);
  }
}

resizeOptimal();
