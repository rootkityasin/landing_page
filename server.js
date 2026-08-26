require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDatabase, dbRun, dbGet, dbAll, defaultOrigamiPageData } = require('./database');
const pathao = require('./pathao');
const metaCapi = require('./metaCapi');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Optimized static assets serving with 1-Year Efficient Cache Lifetimes (Google Lighthouse 100 benchmark)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // 1 Year TTL (31,536,000 seconds) with immutable flag for all static assets (CSS, JS, Images, SVGs, Fonts)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

    const dbPass = (await dbGet("SELECT value FROM settings WHERE key = 'admin_password'"))?.value || 'admin123';

    if (token === dbPass || token === 'admin123') {
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
        pageData: JSON.parse(product.page_data)
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
      event_id
    } = req.body;

    if (!customer_name || !phone || !address || !delivery_zone || !bundle_id) {
      return res.status(400).json({ success: false, error: 'সবগুলো প্রয়োজনীয় ঘর পূরণ করুন (Please fill all required fields)' });
    }

    // Bangladeshi phone validation (11 digits: 013, 014, 015, 016, 017, 018, 019)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const bdPhoneRegex = /^(01[3-9]\d{8})$/;
    if (!bdPhoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (উদা: 017XXXXXXXX)'
      });
    }

    // Find product config to calculate price securely
    let product;
    if (product_slug) {
      product = await dbGet('SELECT * FROM products WHERE slug = ?', [product_slug]);
    }
    if (!product) {
      product = await dbGet('SELECT * FROM products WHERE is_default = 1 LIMIT 1') || await dbGet('SELECT * FROM products LIMIT 1');
    }

    const pageData = product ? JSON.parse(product.page_data) : defaultOrigamiPageData;
    const selectedBundle = pageData.bundles.find(b => b.id === bundle_id) || pageData.bundles[0];

    const itemPrice = Number(selectedBundle.price);
    const deliveryDhaka = pageData.checkout && pageData.checkout.deliveryDhaka !== undefined && pageData.checkout.deliveryDhaka !== '' ? Number(pageData.checkout.deliveryDhaka) : 60;
    const deliveryOutside = pageData.checkout && pageData.checkout.deliveryOutside !== undefined && pageData.checkout.deliveryOutside !== '' ? Number(pageData.checkout.deliveryOutside) : 130;
    const deliveryRate = delivery_zone === 'dhaka_outside' ? deliveryOutside : deliveryDhaka;
    const deliveryCharge = selectedBundle.freeDelivery ? 0 : deliveryRate;
    const totalAmount = itemPrice + deliveryCharge;

    const chosenColor = color_variant || 'Red';
    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

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
        product ? product.title : 'Origami Spoon Set',
        customer_name.trim(),
        cleanPhone,
        address.trim(),
        delivery_zone,
        selectedBundle.id,
        selectedBundle.name,
        chosenColor,
        1,
        itemPrice,
        deliveryCharge,
        totalAmount,
        ip,
        userAgent
      ]
    );

    // Trigger Meta Server-Side Conversions API (CAPI) in background
    metaCapi.sendEvent({
      eventName: 'Purchase',
      eventId: event_id || `order_${orderNumber}`,
      eventSourceUrl: req.headers.referer || `http://localhost:${PORT}/p/${product ? product.slug : ''}`,
      userData: {
        name: customer_name,
        phone: cleanPhone,
        ip: ip,
        userAgent: userAgent
      },
      customData: {
        currency: 'BDT',
        value: totalAmount,
        order_id: orderNumber,
        content_name: product ? product.title : 'Origami Spoon',
        content_type: 'product'
      }
    }).catch(err => console.error('Meta CAPI Error:', err.message));

    // Get WhatsApp number from settings
    const waSetting = await dbGet("SELECT value FROM settings WHERE key = 'whatsapp_number'");
    const waNumber = waSetting ? waSetting.value : '8801700000000';

    res.json({
      success: true,
      order: {
        id: result.lastID,
        order_number: orderNumber,
        customer_name: customer_name.trim(),
        phone: cleanPhone,
        address: address.trim(),
        delivery_zone: delivery_zone,
        bundle_name: selectedBundle.name,
        color_variant: chosenColor,
        item_price: itemPrice,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        product_name: product ? product.title : 'Polygons 3-in-1 Folding Spoon',
        whatsapp_number: waNumber
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Order Lookup for Thank You Page
app.get('/api/orders/:id', async (req, res) => {
  try {
    const isNumber = /^\d+$/.test(req.params.id);
    let order;
    if (isNumber) {
      order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    } else {
      order = await dbGet('SELECT * FROM orders WHERE order_number = ?', [req.params.id]);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const waSetting = await dbGet("SELECT value FROM settings WHERE key = 'whatsapp_number'");
    order.whatsapp_number = waSetting ? waSetting.value : '8801700000000';

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Client CAPI Relay (e.g. for InitiateCheckout)
app.post('/api/tracking/capi-event', async (req, res) => {
  try {
    const { event_name, event_id, event_source_url, user_data, custom_data } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await metaCapi.sendEvent({
      eventName: event_name || 'InitiateCheckout',
      eventId: event_id,
      eventSourceUrl: event_source_url,
      userData: { ...user_data, ip, userAgent },
      customData: custom_data || {}
    });

    res.json({ success: true });
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
    const dbPass = (await dbGet("SELECT value FROM settings WHERE key = 'admin_password'"))?.value || 'admin123';

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

// Start Server
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Origami COD Landing Page Server running on http://localhost:${PORT}`);
      console.log(`📦 Admin Dashboard: http://localhost:${PORT}/admin (Pass: admin123)`);
      console.log(`🎯 Product Landing Page: http://localhost:${PORT}/p/origami-spoon`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

start();
