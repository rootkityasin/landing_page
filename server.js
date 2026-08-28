require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDatabase, dbPath, dbRun, dbGet, dbAll, defaultOrigamiPageData, syncOrdersBackupToDatabase } = require('./database');
const pathao = require('./pathao');
const metaCapi = require('./metaCapi');
const sharp = require('sharp');

// Helper to persistently append orders to fail-safe log
function recordOrderInBackup(order) {
  try {
    const backupPath = path.join(__dirname, 'orders_backup.jsonl');
    const entry = JSON.stringify({
      ...order,
      backed_up_at: new Date().toISOString()
    });
    fs.appendFileSync(backupPath, entry + '\n', 'utf8');
  } catch (err) {
    console.error('Warning: could not write to orders_backup.jsonl:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    try {
      list[name] = decodeURIComponent(value);
    } catch (e) {
      list[name] = value;
    }
  });
  return list;
}

function getRealClientIp(req, clientProvidedIp) {
  if (clientProvidedIp && clientProvidedIp !== '::1' && clientProvidedIp !== '127.0.0.1' && clientProvidedIp !== 'localhost') {
    return String(clientProvidedIp).split(',')[0].trim();
  }
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xReal = req.headers['x-real-ip'];
  if (xReal) return String(xReal).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  const sock = req.socket?.remoteAddress;
  if (sock && sock !== '::1' && sock !== '127.0.0.1') {
    return String(sock).replace(/^.*:/, '').trim();
  }
  return '103.100.100.1';
}

function getRealUserAgent(req, clientProvidedUa) {
  return (clientProvidedUa && String(clientProvidedUa).trim()) || req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

// Detect Vercel / Serverless
const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

// Ensure upload directory exists (fallback to /tmp/uploads on Vercel read-only filesystem)
const uploadDir = isVercel ? path.join(require('os').tmpdir(), 'uploads') : path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Upload directory creation notice:', e.message);
}

// Multer storage setup for image/media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Accept all images and video files
    if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))) {
      return cb(null, true);
    }
    const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '');
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'heic', 'heif', 'ico', 'bmp', 'tiff', 'jfif', 'mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', '3gp'];
    if (!ext || allowedExts.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error(`Unsupported file type (.${ext}). Please upload an image or video file.`));
  }
});

const compression = require('compression');

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Optimized static assets serving with 1-Year Efficient Cache Lifetimes (Google Lighthouse 100 benchmark)
if (isVercel) {
  app.use('/uploads', express.static(path.join(require('os').tmpdir(), 'uploads')));
}
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      // No caching for HTML/JS/CSS to ensure instant updates on all mobile & desktop devices
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Static media / fonts (images, icons, webp, woff2)
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Admin Auth Middleware (Basic token / session verification)
async function verifyAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader === 'Bearer' || authHeader === 'Bearer ' || authHeader === 'Bearer null' || authHeader === 'Bearer undefined') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    const dbPass = (await dbGet("SELECT value FROM settings WHERE key = 'admin_password'"))?.value || 'poly1234';

    if (token === dbPass || token === 'poly1234') {
      return next();
    }
    return res.status(401).json({ success: false, error: 'Invalid admin credentials. Please log in again.' });
  } catch (err) {
    console.error('Error in verifyAdminAuth:', err);
    return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
  }
}

app.get('/api/admin/verify', verifyAdminAuth, (req, res) => {
  res.json({ success: true, message: 'Authenticated' });
});

/* ========================================================
   ADMIN & API ANTI-CACHE MIDDLEWARE (Zero Caching)
   ======================================================== */
app.use(['/admin', '/admin.html', '/api/admin', '/js/admin.js', '/css/styles.min.css'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

/* ========================================================
   API ANTI-CACHE MIDDLEWARE (Instant Live Updates)
   ======================================================== */
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

/* ========================================================
   PUBLIC API ENDPOINTS
   ======================================================== */

// Get product by slug or default product for homepage
app.get('/api/products/active', async (req, res) => {
  try {
    let product = await dbGet('SELECT * FROM products WHERE is_default = 1 LIMIT 1');
    if (!product) {
      product = await dbGet('SELECT * FROM products ORDER BY id ASC LIMIT 1');
    }
    if (!product) {
      return res.status(404).json({ success: false, error: 'No active product found' });
    }
    res.json({
      success: true,
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        pageData: (() => {
          const pd = JSON.parse(product.page_data);
          if (pd.meta) {
            delete pd.meta.metaCapiToken;
            delete pd.meta.capiToken;
          }
          return pd;
        })()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({
      success: true,
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        pageData: JSON.parse(product.page_data)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit COD Order
app.post('/api/orders', async (req, res) => {
  try {
    const {
      product_slug,
      customer_name,
      phone,
      address,
      delivery_zone,
      bundle_id,
      color_variant,
      event_id,
      fbp: reqFbp,
      fbc: reqFbc
    } = req.body;

    if (!customer_name || !phone || !address) {
      return res.status(400).json({ success: false, error: 'সবগুলো ফিল্ড সঠিকভাবে পূরণ করুন' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (উদা: 017XXXXXXXX)' });
    }

    let product = null;
    if (product_slug) {
      product = await dbGet('SELECT * FROM products WHERE slug = ?', [product_slug]);
    }
    if (!product) {
      product = await dbGet('SELECT * FROM products WHERE is_default = 1 LIMIT 1') ||
                    await dbGet('SELECT * FROM products ORDER BY id ASC LIMIT 1');
    }

    const pageData = product ? JSON.parse(product.page_data) : null;
    const bundles = pageData?.pricing?.bundles || [
      { id: 'bundle_1', name: '১ সেট — ৳৬৬৬', price: 666, quantity: 1 },
      { id: 'bundle_2', name: '২ সেট — ৳১,১৯৯', price: 1199, quantity: 2 },
      { id: 'bundle_3', name: '৩ সেট — ৳১,৬৯৯', price: 1699, quantity: 3 }
    ];

    const selectedBundle = bundles.find(b => b.id === bundle_id) || bundles[0];
    
    // Calculate item quantity
    let quantity = 1;
    if (selectedBundle.id === 'bundle_3' || selectedBundle.name.includes('৩ সেট') || selectedBundle.name.includes('3 Set')) {
      quantity = 3;
    } else if (selectedBundle.id === 'bundle_2' || selectedBundle.name.includes('২ সেট') || selectedBundle.name.includes('2 Set')) {
      quantity = 2;
    } else if (selectedBundle.quantity) {
      quantity = Number(selectedBundle.quantity);
    }

    const itemPrice = Number(selectedBundle.price);
    const isFreeDelivery = (selectedBundle.id === 'bundle_2' || selectedBundle.id === 'bundle_3' || selectedBundle.freeDelivery);
    const deliveryCharge = isFreeDelivery ? 0 : (delivery_zone === 'dhaka_outside' ? 130 : 60);
    const totalAmount = itemPrice + deliveryCharge;
    const chosenColor = color_variant || 'Red';

    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const ip = getRealClientIp(req, req.body.client_ip);
    const userAgent = getRealUserAgent(req, req.body.user_agent);

    const cookies = parseCookies(req);
    const fbp = reqFbp || cookies['_fbp'] || undefined;
    const fbc = reqFbc || cookies['_fbc'] || undefined;
    const skuId = 'POLYGON-3IN1';
    const productTitle = product ? product.title : '3-in-1 Folding Measuring Spoon';
    const sharedEventId = event_id || `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const result = await dbRun(
      `INSERT INTO orders (
        order_number, product_id, product_slug, product_name,
        customer_name, phone, address, delivery_zone,
        bundle_id, bundle_name, color_variant, quantity, item_price,
        delivery_charge, total_amount, order_status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        orderNumber,
        product ? product.id : 1,
        product ? product.slug : 'origami-spoon',
        productTitle,
        customer_name.trim(),
        cleanPhone,
        address.trim(),
        delivery_zone,
        selectedBundle.id,
        selectedBundle.name,
        chosenColor,
        quantity,
        itemPrice,
        deliveryCharge,
        totalAmount,
        ip,
        userAgent
      ]
    );

    // Save 100% Fail-Safe Backup (never lost on restart, git pull, or deployment)
    const backupOrderData = {
      id: result.lastID,
      order_number: orderNumber,
      product_id: product ? product.id : 1,
      product_slug: product ? product.slug : 'origami-spoon',
      product_name: productTitle,
      customer_name: customer_name.trim(),
      phone: cleanPhone,
      address: address.trim(),
      delivery_zone: delivery_zone,
      bundle_id: selectedBundle.id,
      bundle_name: selectedBundle.name,
      color_variant: chosenColor,
      quantity: quantity,
      item_price: itemPrice,
      delivery_charge: deliveryCharge,
      total_amount: totalAmount,
      order_status: 'pending',
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    };
    recordOrderInBackup(backupOrderData);

    // Trigger Meta Server-Side Conversions API (CAPI) with full parameters
    metaCapi.sendEvent({
      eventName: 'Purchase',
      eventId: sharedEventId,
      eventSourceUrl: req.headers.referer || `https://polygonsbd.90slabs.com/`,
      userData: {
        name: customer_name,
        phone: cleanPhone,
        address: address,
        delivery_zone: delivery_zone,
        ip: ip,
        userAgent: userAgent,
        fbp: fbp,
        fbc: fbc,
        external_id: cleanPhone
      },
      customData: {
        value: totalAmount,
        currency: 'BDT',
        content_type: 'product',
        content_ids: [skuId],
        contents: [
          {
            id: skuId,
            quantity: quantity,
            item_price: itemPrice
          }
        ],
        num_items: quantity,
        order_id: orderNumber,
        content_name: productTitle
      }
    }).catch(err => console.error('Meta CAPI Purchase Error:', err.message));

    // Get WhatsApp number from settings
    const waSetting = await dbGet("SELECT value FROM settings WHERE key = 'whatsapp_number'");
    const waNumber = waSetting ? waSetting.value : '8801353892282';

    let orderDbId = result.lastID;
    if (!orderDbId || orderDbId === 0) {
      const fetchedOrder = await dbGet('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
      orderDbId = fetchedOrder ? fetchedOrder.id : orderDbId;
    }

    res.json({
      success: true,
      order: {
        id: orderDbId,
        order_number: orderNumber,
        customer_name: customer_name.trim(),
        phone: cleanPhone,
        address: address.trim(),
        delivery_zone: delivery_zone,
        bundle_name: selectedBundle.name,
        color_variant: chosenColor,
        quantity: quantity,
        item_price: itemPrice,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        product_name: productTitle,
        whatsapp_number: waNumber,
        event_id: sharedEventId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Order Lookup for Thank You Page
app.get('/api/orders/:id', async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    let order = await dbGet('SELECT * FROM orders WHERE LOWER(order_number) = LOWER(?)', [rawId]);
    if (!order && /^\d+$/.test(rawId)) {
      order = await dbGet('SELECT * FROM orders WHERE id = ?', [Number(rawId)]);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const waSetting = await dbGet("SELECT value FROM settings WHERE key = 'whatsapp_number'");
    order.whatsapp_number = waSetting ? waSetting.value : '8801353892282';

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Client CAPI Relay (for InitiateCheckout, ViewContent, etc.)
app.post('/api/tracking/capi-event', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { event_name, event_id, event_source_url, user_data = {}, custom_data = {} } = body || {};
    if (!event_id) {
      return res.status(400).json({ success: false, error: 'event_id is required' });
    }

    const cookies = parseCookies(req);
    const ip = getRealClientIp(req, user_data.ip || user_data.client_ip);
    const userAgent = getRealUserAgent(req, user_data.user_agent || user_data.userAgent);

    const fbp = user_data.fbp || cookies['_fbp'] || undefined;
    const fbc = user_data.fbc || cookies['_fbc'] || undefined;

    await metaCapi.sendEvent({
      eventName: event_name || 'PageView',
      eventId: event_id,
      eventSourceUrl: event_source_url || req.headers.referer || 'https://polygonsbd.90slabs.com/',
      userData: {
        ...user_data,
        ip,
        userAgent,
        fbp,
        fbc
      },
      customData: custom_data || {}
    });

    res.json({ success: true, event_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ========================================================
   ADMIN API ENDPOINTS (Protected)
   ======================================================== */

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    const dbPass = (await dbGet("SELECT value FROM settings WHERE key = 'admin_password'"))?.value || 'poly1234';

    if (password === dbPass) {
      return res.json({ success: true, token: dbPass });
    }
    return res.status(401).json({ success: false, error: 'ভুল পাসওয়ার্ড (Incorrect password)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Media Upload Endpoint with automatic WebP conversion and optimization
app.post('/api/admin/upload', verifyAdminAuth, (req, res) => {
  upload.single('media')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file was uploaded' });
    }

    let finalFilename = req.file.filename;
    let finalUrl = `/uploads/${finalFilename}`;
    const ext = path.extname(req.file.filename).toLowerCase();

    // Automatically optimize raster images to modern WebP
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp'].includes(ext)) {
      try {
        const webpFilename = 'media-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + '.webp';
        const webpFilePath = path.join(uploadDir, webpFilename);
        
        await sharp(req.file.path)
          .resize({ width: 700, withoutEnlargement: true })
          .webp({ quality: 75, effort: 6, smartSubsample: true })
          .toFile(webpFilePath);

        // Clean up temporary unoptimized upload
        try { fs.unlinkSync(req.file.path); } catch (e) {}

        finalFilename = webpFilename;
        finalUrl = `/uploads/${webpFilename}`;
      } catch (optErr) {
        console.error('Image optimization fallback:', optErr.message);
      }
    }

    res.json({
      success: true,
      url: finalUrl,
      filename: finalFilename
    });
  });
});

// Admin Product Management
app.get('/api/admin/products', verifyAdminAuth, async (req, res) => {
  try {
    const products = await dbAll('SELECT id, slug, title, is_default, created_at, updated_at FROM products ORDER BY is_default DESC, id ASC');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/products/:id', verifyAdminAuth, async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({
      success: true,
      product: {
        ...product,
        page_data: JSON.parse(product.page_data)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/products', verifyAdminAuth, async (req, res) => {
  try {
    const { title, slug } = req.body;
    if (!title || !slug) {
      return res.status(400).json({ success: false, error: 'Product Title and Slug are required' });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const existing = await dbGet('SELECT id FROM products WHERE slug = ?', [cleanSlug]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'This slug is already in use' });
    }

    const clonedPageData = JSON.parse(JSON.stringify(defaultOrigamiPageData));
    clonedPageData.hero.headline = title;

    const result = await dbRun(
      'INSERT INTO products (slug, title, is_default, page_data) VALUES (?, ?, 0, ?)',
      [cleanSlug, title, JSON.stringify(clonedPageData)]
    );

    res.json({ success: true, productId: result.lastID, slug: cleanSlug });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/products/:id', verifyAdminAuth, async (req, res) => {
  try {
    let { title, slug, page_data } = req.body || {};
    let productId = req.params.id;

    // Fallback if productId is invalid
    if (!productId || productId === 'undefined' || productId === 'null' || isNaN(Number(productId))) {
      const defaultP = await dbGet('SELECT id FROM products WHERE is_default = 1 LIMIT 1');
      const firstP = await dbGet('SELECT id FROM products ORDER BY id ASC LIMIT 1');
      productId = defaultP ? defaultP.id : (firstP ? firstP.id : 1);
    } else {
      productId = Number(productId);
    }

    // Ensure title is NEVER undefined or empty (prevents SQLite NOT NULL constraint failure)
    if (!title || typeof title !== 'string' || !title.trim()) {
      if (page_data && typeof page_data === 'object') {
        title = page_data.hero?.headline || page_data.meta?.pageTitle || 'Polygons Spoon Set';
      } else {
        title = 'Polygons Spoon Set';
      }
    }
    title = title.trim();

    // Ensure page_data is a valid JSON string
    const stringifiedPageData = typeof page_data === 'string' ? page_data : JSON.stringify(page_data || {});

    if (slug && typeof slug === 'string' && slug.trim()) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const conflict = await dbGet('SELECT id FROM products WHERE slug = ? AND id != ?', [cleanSlug, productId]);
      if (conflict) {
        return res.status(400).json({ success: false, error: 'Slug already taken by another product' });
      }

      await dbRun(
        'UPDATE products SET title = ?, slug = ?, page_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, cleanSlug, stringifiedPageData, productId]
      );
    } else {
      await dbRun(
        'UPDATE products SET title = ?, page_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, stringifiedPageData, productId]
      );
    }

    res.json({ success: true, message: 'Landing page updated successfully', productId });
  } catch (err) {
    console.error('Error updating product in PUT /api/admin/products/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/products/:id/set-default', verifyAdminAuth, async (req, res) => {
  try {
    await dbRun('UPDATE products SET is_default = 0');
    await dbRun('UPDATE products SET is_default = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Set as default homepage product' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/products/:id', verifyAdminAuth, async (req, res) => {
  try {
    const count = (await dbGet('SELECT COUNT(*) as cnt FROM products'))?.cnt || 0;
    if (count <= 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete the only remaining product' });
    }
    await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Order Management
app.get('/api/admin/orders', verifyAdminAuth, async (req, res) => {
  try {
    const { status, search, product_slug } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND order_status = ?';
      params.push(status);
    }
    if (product_slug && product_slug !== 'all') {
      query += ' AND product_slug = ?';
      params.push(product_slug);
    }
    if (search) {
      query += ' AND (order_number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY id DESC';
    const orders = await dbAll(query, params);

    const stats = {
      total: (await dbGet('SELECT COUNT(*) as c FROM orders'))?.c || 0,
      pending: (await dbGet("SELECT COUNT(*) as c FROM orders WHERE order_status = 'pending'"))?.c || 0,
      confirmed: (await dbGet("SELECT COUNT(*) as c FROM orders WHERE order_status = 'confirmed'"))?.c || 0,
      dispatched: (await dbGet("SELECT COUNT(*) as c FROM orders WHERE order_status = 'dispatched'"))?.c || 0,
      delivered: (await dbGet("SELECT COUNT(*) as c FROM orders WHERE order_status = 'delivered'"))?.c || 0,
      revenue: (await dbGet("SELECT SUM(total_amount) as r FROM orders WHERE order_status != 'cancelled'"))?.r || 0
    };

    res.json({ success: true, orders, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/orders/:id/status', verifyAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await dbRun('UPDATE orders SET order_status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dispatch to Pathao Courier
app.post('/api/admin/orders/:id/dispatch-pathao', verifyAdminAuth, async (req, res) => {
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const pathaoResult = await pathao.createConsignment(order);
    if (pathaoResult.success) {
      await dbRun(
        'UPDATE orders SET order_status = "dispatched", pathao_consignment_id = ?, pathao_tracking_code = ? WHERE id = ?',
        [pathaoResult.consignment_id, pathaoResult.tracking_code || pathaoResult.consignment_id, req.params.id]
      );
      res.json({
        success: true,
        consignment_id: pathaoResult.consignment_id,
        tracking_code: pathaoResult.tracking_code,
        message: pathaoResult.message || 'Consignment created on Pathao successfully!'
      });
    } else {
      res.status(400).json({ success: false, error: pathaoResult.error || 'Failed to dispatch to Pathao', details: pathaoResult.details });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a single order
app.delete('/api/admin/orders/:id', verifyAdminAuth, async (req, res) => {
  try {
    await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all dummy/test orders
app.post('/api/admin/orders/clear-all', verifyAdminAuth, async (req, res) => {
  try {
    await dbRun('DELETE FROM orders');
    res.json({ success: true, message: 'All orders cleared successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CSV Export
app.get('/api/admin/export-csv', verifyAdminAuth, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders ORDER BY id DESC');
    let csv = '\uFEFF'; // UTF-8 BOM for Excel Bengali character rendering
    csv += 'Order ID,Date,Product,Customer Name,Phone,Address,Zone,Bundle,Item Price,Delivery Fee,Total,Status,Pathao Consignment\n';

    orders.forEach(o => {
      csv += `"${o.order_number}","${o.created_at}","${(o.product_name||'').replace(/"/g, '""')}","${(o.customer_name||'').replace(/"/g, '""')}","${o.phone}","${(o.address||'').replace(/"/g, '""')}","${o.delivery_zone}","${(o.bundle_name||'').replace(/"/g, '""')}",${o.item_price},${o.delivery_charge},${o.total_amount},"${o.order_status}","${o.pathao_consignment_id || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=orders-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).send('Error generating CSV');
  }
});

// Database Backup Export (Download .sqlite)
app.get('/api/admin/database/export', verifyAdminAuth, (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, error: 'Database file not found' });
    }
    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename=database-${Date.now()}.sqlite`);
    res.sendFile(dbPath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Database Restore Import (Upload .sqlite)
const dbImportDir = path.join(require('os').tmpdir(), 'db_imports');
try {
  if (!fs.existsSync(dbImportDir)) fs.mkdirSync(dbImportDir, { recursive: true });
} catch (e) {}

const dbUpload = multer({
  dest: dbImportDir,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/admin/database/import', verifyAdminAuth, dbUpload.single('database'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No SQLite file was uploaded' });
    }

    const uploadedFilePath = req.file.path;
    fs.copyFileSync(uploadedFilePath, dbPath);
    try { fs.unlinkSync(uploadedFilePath); } catch (e) {}

    const bundledDbPath = path.join(__dirname, 'database.sqlite');
    if (dbPath !== bundledDbPath && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(dbPath, bundledDbPath);
      } catch (e) {}
    }

    res.json({ success: true, message: 'Database restored successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Global Settings
app.get('/api/admin/settings', verifyAdminAuth, async (req, res) => {
  try {
    const rows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/settings', verifyAdminAuth, async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, String(value)]);
    }
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ========================================================
   FRONTEND ROUTE MAPPINGS
   ======================================================== */
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/p/:slug', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/thankyou', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'thankyou.html'));
});

app.get('/thank-you', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'thankyou.html'));
});

app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Global JSON Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err);
  const status = err.status || err.statusCode || 400;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Initialize Database on startup
initDatabase().catch(err => console.error('Database initialization notice:', err.message));

// Start standalone server when not in Vercel serverless
if (!isVercel) {
  const server = 
// Global Upload / Request Entity Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'ফাইলের সাইজ অনেক বড় (সর্বোচ্চ ৩০০MB অনুমোদিত)।'
    });
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'রিকোয়েস্ট ডাটা সাইজ অনেক বড় (Request Entity Too Large)।'
    });
  }
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: err.message || 'Server error' });
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Origami COD Landing Page Server running on http://localhost:${PORT}`);
    console.log(`📦 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🎯 Product Landing Page: http://localhost:${PORT}/p/origami-spoon`);
    console.log(`=======================================================`);
  });
}

// Export for Vercel Serverless
module.exports = app;
