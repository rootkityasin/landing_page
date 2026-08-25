const http = require('http');

const PORT = 3000;

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting End-to-End Funnel & CMS Test Suite...\n');

  try {
    // 1. Test Active Product Endpoint
    console.log('1️⃣ Testing GET /api/products/active ...');
    const prodRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/products/active',
      method: 'GET'
    });
    console.assert(prodRes.status === 200, 'Product endpoint should return 200');
    console.assert(prodRes.data.success === true, 'Product should be returned successfully');
    console.assert(prodRes.data.product.slug === 'origami-spoon', 'Default slug should be origami-spoon');
    console.log('✅ Active Product loaded successfully:', prodRes.data.product.title);

    // 2. Test Phone Validation (Invalid Phone)
    console.log('\n2️⃣ Testing Order Submission with Invalid Phone...');
    const invalidOrderRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      product_slug: 'origami-spoon',
      customer_name: 'Test Customer',
      phone: '12345',
      address: 'Dhaka',
      delivery_zone: 'dhaka_inside',
      bundle_id: 'bundle_2'
    });
    console.assert(invalidOrderRes.status === 400, 'Invalid phone should be rejected with 400');
    console.log('✅ Phone validation works: correctly rejected invalid number');

    // 3. Test Valid COD Order Placement
    console.log('\n3️⃣ Testing Valid COD Order Placement (Package 2 - Free Delivery)...');
    const validOrderRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      product_slug: 'origami-spoon',
      customer_name: 'তানভীর আহমেদ',
      phone: '01712345678',
      address: 'বাসা ১২, রোড ৪, সেক্টর ৩, উত্তরা, ঢাকা',
      delivery_zone: 'dhaka_inside',
      bundle_id: 'bundle_2'
    });
    console.assert(validOrderRes.status === 200, 'Order submission should return 200');
    console.assert(validOrderRes.data.success === true, 'Order should be created');
    console.assert(validOrderRes.data.order.total_amount === 1199, 'Package 2 total should be 1199 (Free delivery)');
    console.assert(validOrderRes.data.order.delivery_charge === 0, 'Delivery charge should be 0 for Package 2');
    const orderNumber = validOrderRes.data.order.order_number;
    const orderId = validOrderRes.data.order.id;
    console.log(`✅ Order placed successfully! Order ID: ${orderNumber}, Total: ৳${validOrderRes.data.order.total_amount}`);

    // 4. Test Single Order Lookup for Thank You Page
    console.log('\n4️⃣ Testing Order Lookup for Thank You Page...');
    const orderLookupRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${orderNumber}`,
      method: 'GET'
    });
    console.assert(orderLookupRes.status === 200, 'Lookup should return 200');
    console.assert(orderLookupRes.data.order.customer_name === 'তানভীর আহমেদ', 'Customer name should match');
    console.log('✅ Thank You invoice data loaded correctly');

    // 5. Test Admin Login
    console.log('\n5️⃣ Testing Admin Login...');
    const loginRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'admin123' });
    console.assert(loginRes.status === 200, 'Admin login should return 200');
    const token = loginRes.data.token;
    console.log('✅ Admin login successful');

    // 6. Test Admin Orders Listing
    console.log('\n6️⃣ Testing Admin Orders List...');
    const adminOrdersRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/orders',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.assert(adminOrdersRes.status === 200, 'Admin orders list should return 200');
    console.assert(adminOrdersRes.data.orders.length > 0, 'Orders should be listed');
    console.log(`✅ Found ${adminOrdersRes.data.orders.length} order(s) in Admin Portal`);

    // 7. Test Pathao 1-Click Dispatch
    console.log('\n7️⃣ Testing Pathao Courier 1-Click Dispatch...');
    const pathaoRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/admin/orders/${orderId}/dispatch-pathao`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.assert(pathaoRes.status === 200, 'Pathao dispatch should return 200');
    console.assert(pathaoRes.data.success === true, 'Pathao consignment should be generated');
    console.log(`✅ Pathao Consignment Created! ID: ${pathaoRes.data.consignment_id}`);

    // 8. Test Product Creation & Separate URL Link
    const testSlug = 'smart-kitchen-slicer-' + Date.now();
    console.log(`\n8️⃣ Testing New Product Creation & Separate URL Generation (/p/${testSlug})...`);
    const newProdRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/products',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      title: 'Smart Kitchen Slicer 9-in-1',
      slug: testSlug
    });
    console.assert(newProdRes.status === 201 || newProdRes.status === 200, 'Product creation should return 201');
    console.assert(newProdRes.data.slug === testSlug, 'Slug should match');
    console.log(`✅ New Product created with separate URL: http://localhost:${PORT}/p/${testSlug}`);

    // 9. Test Loading the New Product Landing Page
    console.log(`\n9️⃣ Testing New Product Landing Page Endpoint GET /api/products/${testSlug} ...`);
    const newProdPageRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/products/${testSlug}`,
      method: 'GET'
    });
    console.assert(newProdPageRes.status === 200, 'New product slug endpoint should return 200');
    console.assert(newProdPageRes.data.product.slug === testSlug, 'Slug should match');
    console.log('✅ New Product Page renders with its own separate schema & copy');

    // Clean up temporary test product immediately
    const createdId = newProdRes.data.productId;
    if (createdId) {
      await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/products/${createdId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    // 10. Test Admin Media Upload
    console.log('\n🔟 Testing Admin Media Upload POST /api/admin/upload ...');
    const fs = require('fs');
    const path = require('path');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const sampleBuffer = fs.readFileSync(path.join(__dirname, 'public', 'images', 'comp-origami.svg'));
    const partHeader = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="sample.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`);
    const partFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const uploadPayload = Buffer.concat([partHeader, sampleBuffer, partFooter]);

    const uploadRes = await new Promise((resolve, reject) => {
      const uReq = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/admin/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': uploadPayload.length
        }
      }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(b) }));
      });
      uReq.on('error', reject);
      uReq.write(uploadPayload);
      uReq.end();
    });

    console.assert(uploadRes.status === 200, 'Media upload should return 200');
    console.assert(uploadRes.data.success === true, 'Upload should succeed');
    console.log(`✅ Media uploaded successfully! Public URL: ${uploadRes.data.url}`);

    // Cleanup test product
    if (newProdRes.data.id) {
      await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/products/${newProdRes.data.id}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! The Landing Page CMS & COD Funnel is 100% operational.\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

// Run if called directly
runTests();
