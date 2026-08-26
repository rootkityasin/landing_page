const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeAll() {
  console.log('🚀 Starting Ultra-Fast Image Compression & WebP Conversion...');
  
  const dirs = ['public/uploads', 'public/images', 'public/images/payments'];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const filePath = path.join(dir, f);
      if (!fs.statSync(filePath).isFile()) continue;
      
      const ext = path.extname(f).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
      if (f.endsWith('.webp')) continue;

      const origSize = fs.statSync(filePath).size;
      if (origSize < 2 * 1024) continue; // Skip tiny icons under 2KB

      totalOriginal += origSize;
      const webpPath = path.join(dir, path.basename(f, ext) + '.webp');

      try {
        const metadata = await sharp(filePath).metadata();
        let pipeline = sharp(filePath);

        // Responsive resizing constraints
        if (dir.includes('payments')) {
          pipeline = pipeline.resize({ width: 120, height: 80, fit: 'inside', withoutEnlargement: true });
        } else if (metadata.width && metadata.width > 1200) {
          pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
        }

        // WebP output
        await pipeline
          .webp({ quality: 80, effort: 6 })
          .toFile(webpPath);

        const newSize = fs.statSync(webpPath).size;
        totalOptimized += newSize;

        const savingsPercent = (((origSize - newSize) / origSize) * 100).toFixed(1);
        console.log(`✅ [${f}] -> [${path.basename(webpPath)}]: ${(origSize/1024).toFixed(1)} KB -> ${(newSize/1024).toFixed(1)} KB (-${savingsPercent}%)`);

        // Also compress the original PNG/JPG in-place for fallbacks
        if (ext === '.png') {
          const compressedPng = await sharp(filePath)
            .resize({ width: metadata.width > 1200 ? 1200 : metadata.width, withoutEnlargement: true })
            .png({ compressionLevel: 9, quality: 80 })
            .toBuffer();
          if (compressedPng.length < origSize) {
            fs.writeFileSync(filePath, compressedPng);
          }
        } else if (ext === '.jpg' || ext === '.jpeg') {
          const compressedJpg = await sharp(filePath)
            .resize({ width: metadata.width > 1200 ? 1200 : metadata.width, withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
          if (compressedJpg.length < origSize) {
            fs.writeFileSync(filePath, compressedJpg);
          }
        }

      } catch (err) {
        console.error(`❌ Failed optimizing ${f}:`, err.message);
      }
    }
  }

  const savedMB = ((totalOriginal - totalOptimized) / (1024 * 1024)).toFixed(2);
  const totalSavedPercent = (((totalOriginal - totalOptimized) / totalOriginal) * 100).toFixed(1);
  console.log(`\n🎉 Optimization Complete!`);
  console.log(`📊 Original Size: ${(totalOriginal / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`⚡ Optimized Size: ${(totalOptimized / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`💰 Total Savings: ${savedMB} MB (-${totalSavedPercent}% reduction!)\n`);
}

optimizeAll();
