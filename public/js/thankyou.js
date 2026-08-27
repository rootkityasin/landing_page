let currentOrder = null;

function toBanglaDigits(num) {
  if (num === null || num === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => banglaDigits[d]);
}

function parseUrlOrderData() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const dParam = urlParams.get('d') || urlParams.get('data');
    if (!dParam) return null;
    const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(dParam))));
    const c = JSON.parse(jsonStr);
    if (!c) return null;
    return {
      order_number: c.id || urlParams.get('orderId') || urlParams.get('id'),
      customer_name: c.n || '',
      phone: c.p || '',
      address: c.a || '',
      bundle_name: c.b || '১ সেট — ৳৬৬৬',
      color_variant: c.c || 'Red',
      item_price: Number(c.pr) || 666,
      delivery_charge: Number(c.dc) || 60,
      total_amount: Number(c.t) || (Number(c.pr) + Number(c.dc)),
      whatsapp_number: c.w || '8801353892282',
      created_at: new Date().toISOString()
    };
  } catch (e) {
    return null;
  }
}

function renderOrderDetails(order) {
  if (!order) return;
  currentOrder = order;

  const orderNum = order.order_number || 'N/A';
  const orderNumEl = document.getElementById('order-number-display');
  if (orderNumEl) orderNumEl.innerText = orderNum;

  const printOrderNumEl = document.getElementById('print-order-num');
  if (printOrderNumEl) printOrderNumEl.innerText = 'Order #' + orderNum;

  const nameEl = document.getElementById('inv-cust-name');
  if (nameEl) nameEl.innerText = order.customer_name || 'সম্মানিত গ্রাহক';

  const phoneEl = document.getElementById('inv-cust-phone');
  if (phoneEl) phoneEl.innerText = order.phone || '-';

  const addrEl = document.getElementById('inv-cust-address');
  if (addrEl) addrEl.innerText = order.address || '-';

  const bundleEl = document.getElementById('inv-bundle-name');
  if (bundleEl) bundleEl.innerText = order.bundle_name || order.product_name || 'Polygons 3-in-1 Spoon Set';

  const colorText = order.color_variant === 'Black' ? 'ক্লাসিক ব্ল্যাক (Classic Black)' :
                    order.color_variant === 'Mixed' ? 'মিক্সড কালার কম্বো (Mixed Combo)' :
                    'মেরুন রেড (Maroon Red)';
  const colorEl = document.getElementById('inv-color-name');
  if (colorEl) colorEl.innerText = colorText;

  const itemPrice = Number(order.item_price) || 0;
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const totalAmount = Number(order.total_amount) || (itemPrice + deliveryCharge);

  const priceEl = document.getElementById('inv-item-price');
  if (priceEl) priceEl.innerText = '৳' + toBanglaDigits(itemPrice);

  const delEl = document.getElementById('inv-delivery-charge');
  if (delEl) {
    if (deliveryCharge === 0) {
      delEl.innerHTML = '<span class="text-emerald-600 font-bold">ফ্রি (৳০)</span>';
    } else {
      delEl.innerText = '৳' + toBanglaDigits(deliveryCharge);
    }
  }

  const totalEl = document.getElementById('inv-total-amount');
  if (totalEl) totalEl.innerText = '৳' + toBanglaDigits(totalAmount);

  const d = order.created_at ? new Date(order.created_at) : new Date();
  const dateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const dateEl = document.getElementById('inv-date-time');
  if (dateEl) {
    dateEl.innerText = dateFormatted;
  }

  const printDateEl = document.getElementById('print-order-date');
  if (printDateEl) {
    printDateEl.innerText = 'Date: ' + dateFormatted;
  }

  // Update WhatsApp Link
  const waNumber = order.whatsapp_number || '8801353892282';
  const waMessage = encodeURIComponent(
    'হ্যালো! আমি ওয়েবসাইট থেকে একটি অর্ডার করেছি।\n\n' +
    '📦 অর্ডার নম্বর: ' + (order.order_number || '') + '\n' +
    '👤 নাম: ' + (order.customer_name || '') + '\n' +
    '📱 ফোন: ' + (order.phone || '') + '\n' +
    '📍 ঠিকানা: ' + (order.address || '') + '\n' +
    '🎁 প্যাকেজ: ' + (order.bundle_name || order.product_name || '') + '\n' +
    '🎨 কালার: ' + colorText + '\n' +
    '💰 মোট বিল: ৳' + totalAmount + ' (ক্যাশ অন ডেলিভারি)\n\n' +
    'দয়া করে আমার অর্ডারটি ফাস্ট ডেলিভারির জন্য কনফার্ম করুন।'
  );

  const waBtn = document.getElementById('whatsapp-confirm-btn');
  if (waBtn) {
    waBtn.href = 'https://wa.me/' + waNumber + '?text=' + waMessage;
  }
}

async function loadOrderDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = (urlParams.get('orderId') || urlParams.get('id') || '').trim();

  // Layer 1: Query param payload
  const urlOrder = parseUrlOrderData();
  if (urlOrder) {
    renderOrderDetails(urlOrder);
  }

  // Layer 2: Storage cache
  if (!currentOrder) {
    try {
      const sessionData = JSON.parse(sessionStorage.getItem('polygons_last_order') || 'null');
      if (sessionData && (sessionData.order_number === orderId || !orderId)) {
        renderOrderDetails(sessionData);
      } else if (orderId) {
        const localData = JSON.parse(localStorage.getItem('polygons_order_' + orderId) || 'null');
        if (localData) renderOrderDetails(localData);
      }
    } catch (e) {}
  }

  if (!orderId && !currentOrder) {
    document.getElementById('order-number-display').innerText = 'N/A';
    return;
  }

  if (orderId && !document.getElementById('order-number-display').innerText.startsWith('ORD')) {
    document.getElementById('order-number-display').innerText = orderId;
  }

  // Layer 3: Authoritative Database API fetch
  if (orderId) {
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderId));
      const data = await res.json();
      if (data.success && data.order) {
        renderOrderDetails(data.order);
        try {
          localStorage.setItem('polygons_order_' + orderId, JSON.stringify(data.order));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('API lookup notice:', err);
    }
  }
}

// Download / Print as PDF
function printInvoice() {
  if (currentOrder && currentOrder.order_number) {
    document.title = 'Invoice_' + currentOrder.order_number + '_Polygons';
  }
  window.print();
}

// Download Daraz-Style Clean Standalone HTML Invoice File
function downloadInvoiceFile() {
  if (!currentOrder) {
    alert('ইনভয়েস তথ্য পাওয়া যায়নি। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।');
    return;
  }

  const o = currentOrder;
  const colorText = o.color_variant === 'Black' ? 'Classic Black' :
                    o.color_variant === 'Mixed' ? 'Mixed Combo' :
                    'Maroon Red';
  const itemPrice = Number(o.item_price) || 0;
  const deliveryCharge = Number(o.delivery_charge) || 0;
  const totalAmount = Number(o.total_amount) || (itemPrice + deliveryCharge);
  const now = new Date(o.created_at || Date.now());
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const logoSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANIAAABACAMAAABY6dk4AAAAOVBMVEVMaXEBAQEDAwMAAAAiHh8LCQkHBgYAAAADAwMEBAQAAAABAQEFBAQHBgYAAAAAAAAAAAAhHh8AAAB+Wf4GAAAAEnRSTlMAshbe/iULA545XHVIjMzs+OVYHqKjAAAACXBIWXMAAAsSAAALEgHS3X78AAADxElEQVRo3u1Xa5ejIAwVLC/lYfn/P3YTsBoKOt3OftvcczqjIEluEkKYJgaDwWAwGAwGg8FgMBgMBuP/hKnoh+uvGxy9jsaHiztFZvB0qf5tqT5gPuE5VvSZj34v8SOtRjwrHqGdUBaxurfv1SpiFItp3OjEQk1zYt2f/P60m+NtjNEusjHSLDAqVtWo0b4KRGH+kG0mvYoZPtY3jOTkHjtk6w6fK2zjmRVG0pbz7CiHJVvqQJlyndZzPuwxk4qvxY075py3BDNroz9VJxnQGIgI+Dgl/NZcxtGFKVRGvvkKZrLQUrp4SgTYnFaltbM5U9+1lNAdsfwP1By3ZeGl1hBnTdVk63AwgQyif3cGyib2i2ylMXJ1N5QUUHkiI9t+VCiVRMtJHmNrnveX5Rzuo2RANTqZrC0RW/stAQFd9qdIbQdKG9rdUpLb/PNuU48n/B6Pp+ziB5RQZMzqJVJjQuladpoAdJSAjJ52Yoc7bOViaDyLmJKjoJA4wGA6KpxqKOV5qrG7pQTxWd/T7qAEIucXJZQu9s9eRo8p7abW9Hsh5kG2mEP6EdrXRFqRom4TL5ZImx+ihHSedjJ9lEpu+2Mzo50LlX4a806p2OoaEvIsCuepBY6JNH0DobRhmuuJUio1S/jbMFVKT63koHDk6Jcl5IOGgeJA6pc4DB5QwqFEBhvju+w+7LWUkgQXxjZKsACq5ryaa06V0sMOa2Gt4fNyDtk2Su4uSkA5UUepfOxsHxTx27jIFEqgULSJBw9YbaP8IUqPMEjyEiXvHd3L5IiAUrHJy7307vNa8ORB9gi23MiODDQehRIW7aU5RfBJilqM7xLPjKNk3xuWUhLKuyal4iNKGOK1Vkt4ck1J0HtjcJaKnZLBXJgppdrglaJyS2l0bp0Vb2rMsnuHqRLdV4VS0+P2lBQeNGXxuSVRS1K7SHs66RUl4Al7p0miokUQ8iNKYbqIkugm5Aynd9kO1He1Vk33iYdpuy17C0K8EXLyRbQ9jnGSeAZVnumofYmoOw+Q8VFrLlqlnlJt04S1xXVNeZsFIlxTqv3hbAMupqdgwFEr4C/1vEl162F0AzlqNxGCuO/x1GPcLtW91N1sJrPCsQ6CfVuxt7QBSJ1GSl34ncX2dIttI+3ElrvKbOL8qiaeFI2A2nNc7o5aFy6TUuvxfUU5J98OOzO4cRndO2TSyqmu9ZokjL43BfqshM24dE7dd3laf3WPM1/cAM9Vwyuw+Ytb5FfaP7Hsy9v/LyWaf86HwWAwGAwGg8FgMBgMBuP/wx9vpC7Gv0tOLQAAAABJRU5ErkJggg==';

  const htmlContent = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'  <meta charset="UTF-8" />' +
'  <title>Invoice #' + o.order_number + ' - Polygons</title>' +
'  <style>' +
'    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }' +
'    body { background: #f8fafc; padding: 30px 15px; color: #0f172a; }' +
'    .invoice-container { max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }' +
'    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 20px; }' +
'    .brand img { height: 38px; width: auto; margin-bottom: 6px; display: block; }' +
'    .brand-sub { font-size: 12px; color: #64748b; font-weight: 500; }' +
'    .invoice-meta { text-align: right; }' +
'    .invoice-meta h1 { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; }' +
'    .invoice-meta .order-id { font-size: 13px; font-weight: 700; color: #d92143; margin-top: 2px; }' +
'    .invoice-meta .order-date { font-size: 12px; color: #64748b; margin-top: 2px; }' +
'    .payment-tag { display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 6px; }' +
'    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }' +
'    .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 13px; }' +
'    .customer-box { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 12px 14px; }' +
'    .customer-box .name { font-weight: 800; color: #0f172a; font-size: 14px; margin-bottom: 2px; }' +
'    .customer-box .detail { color: #475569; margin-top: 2px; line-height: 1.4; }' +
'    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }' +
'    .items-table th { background: #0f172a; color: #ffffff; text-align: left; padding: 9px 12px; font-weight: 700; font-size: 12px; }' +
'    .items-table th:last-child { text-align: right; }' +
'    .items-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }' +
'    .items-table td:last-child { text-align: right; font-weight: 700; color: #0f172a; }' +
'    .item-desc { font-weight: 700; color: #0f172a; }' +
'    .item-color { font-size: 12px; color: #64748b; margin-top: 2px; }' +
'    .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 25px; }' +
'    .summary-table { width: 260px; font-size: 13px; }' +
'    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; color: #475569; }' +
'    .summary-row.total { border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; font-size: 15px; font-weight: 900; color: #d92143; }' +
'    .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #94a3b8; }' +
'    .footer p { margin-top: 2px; }' +
'    .btn-print { margin-top: 15px; background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; }' +
'    @media print { body { background: #fff; padding: 0; } .invoice-container { border: none; box-shadow: none; padding: 0; } .btn-print { display: none; } }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="invoice-container">' +
'    <div class="header">' +
'      <div class="brand">' +
'        <img src="' + logoSrc + '" alt="Polygons" />' +
'        <div class="brand-sub">Polygons Bangladesh</div>' +
'        <div class="brand-sub" style="display:flex;align-items:center;gap:10px;margin-top:4px;font-size:12px;">' +
'          <span style="color:#0f172a;font-weight:700;">📞 01353-892282</span>' +
'          <span style="color:#cbd5e1;">•</span>' +
'          <span style="color:#25D366;font-weight:700;">💬 01353-892282</span>' +
'          <span style="color:#cbd5e1;">•</span>' +
'          <span style="color:#64748b;">✉️ info.polygonsbd@gmail.com</span>' +
'        </div>' +
'      </div>' +
'      <div class="invoice-meta">' +
'        <h1>INVOICE</h1>' +
'        <div class="order-id">#' + o.order_number + '</div>' +
'        <div class="order-date">' + dateStr + '</div>' +
'        <div class="payment-tag">Cash on Delivery (COD)</div>' +
'      </div>' +
'    </div>' +
'    <div class="customer-grid">' +
'      <div class="customer-box">' +
'        <div class="section-title">Customer Info</div>' +
'        <div class="name">' + (o.customer_name || 'Customer') + '</div>' +
'        <div class="detail">Phone: ' + (o.phone || '-') + '</div>' +
'      </div>' +
'      <div class="customer-box">' +
'        <div class="section-title">Shipping Address</div>' +
'        <div class="detail">' + (o.address || '-') + '</div>' +
'      </div>' +
'    </div>' +
'    <table class="items-table">' +
'      <thead>' +
'        <tr>' +
'          <th>Item Description</th>' +
'          <th>Color</th>' +
'          <th style="text-align:center;">Qty</th>' +
'          <th>Price</th>' +
'        </tr>' +
'      </thead>' +
'      <tbody>' +
'        <tr>' +
'          <td>' +
'            <div class="item-desc">' + (o.bundle_name || o.product_name || 'Polygons Spoon Set') + '</div>' +
'          </td>' +
'          <td><div class="item-color">' + colorText + '</div></td>' +
'          <td style="text-align:center;">1</td>' +
'          <td>৳' + itemPrice + '</td>' +
'        </tr>' +
'      </tbody>' +
'    </table>' +
'    <div class="summary-wrap">' +
'      <div class="summary-table">' +
'        <div class="summary-row">' +
'          <span>Subtotal:</span>' +
'          <span>৳' + itemPrice + '</span>' +
'        </div>' +
'        <div class="summary-row">' +
'          <span>Delivery Fee:</span>' +
'          <span>' + (deliveryCharge === 0 ? '<strong style="color:#166534;">FREE</strong>' : '৳' + deliveryCharge) + '</span>' +
'        </div>' +
'        <div class="summary-row total">' +
'          <span>Total Amount:</span>' +
'          <span>৳' + totalAmount + '</span>' +
'        </div>' +
'      </div>' +
'    </div>' +
'    <div class="footer">' +
'      <p>Thank you for your order with Polygons!</p>' +
'      <p>© 2026 Polygons LLC. All Rights Reserved. • 📞 01353-892282 • 💬 01353-892282 • ✉️ info.polygonsbd@gmail.com</p>' +
'      <button class="btn-print" onclick="window.print()">Print Invoice</button>' +
'    </div>' +
'  </div>' +
'</body>' +
'</html>';

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Invoice_' + (o.order_number || 'Polygons') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

document.addEventListener('DOMContentLoaded', loadOrderDetails);
