function toBanglaDigits(num) {
  if (num === null || num === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => banglaDigits[d]);
}

async function loadOrderDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId') || urlParams.get('id');

  if (!orderId) {
    document.getElementById('order-number-display').innerText = 'N/A';
    return;
  }

  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();

    if (!data.success || !data.order) {
      document.getElementById('order-number-display').innerText = orderId;
      return;
    }

    const order = data.order;
    document.getElementById('order-number-display').innerText = order.order_number;
    document.getElementById('inv-cust-name').innerText = order.customer_name;
    document.getElementById('inv-cust-phone').innerText = order.phone;
    document.getElementById('inv-cust-address').innerText = order.address;
    document.getElementById('inv-bundle-name').innerText = order.bundle_name || 'Origami Spoon Set';
    document.getElementById('inv-item-price').innerText = `৳${toBanglaDigits(order.item_price)}`;
    
    if (order.delivery_charge === 0) {
      document.getElementById('inv-delivery-charge').innerHTML = '<span class="text-emerald-600 font-bold">ফ্রি (৳০)</span>';
    } else {
      document.getElementById('inv-delivery-charge').innerText = `৳${toBanglaDigits(order.delivery_charge)}`;
    }
    
    document.getElementById('inv-total-amount').innerText = `৳${toBanglaDigits(order.total_amount)}`;

    // Build WhatsApp Confirmation link
    const waNumber = order.whatsapp_number || '8801700000000';
    const waMessage = encodeURIComponent(
      `হ্যালো! আমি ওয়েবসাইট থেকে একটি অর্ডার করেছি।\n\n` +
      `📦 অর্ডার নম্বর: ${order.order_number}\n` +
      `👤 নাম: ${order.customer_name}\n` +
      `📱 ফোন: ${order.phone}\n` +
      `📍 ঠিকানা: ${order.address}\n` +
      `🎁 প্যাকেজ: ${order.bundle_name}\n` +
      `💰 মোট বিল: ৳${order.total_amount} (ক্যাশ অন ডেলিভারি)\n\n` +
      `দয়া করে আমার অর্ডারটি ফাস্ট ডেলিভারির জন্য কনফার্ম করুন।`
    );

    const waBtn = document.getElementById('whatsapp-confirm-btn');
    waBtn.href = `https://wa.me/${waNumber}?text=${waMessage}`;

  } catch (err) {
    console.error('Error fetching order:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadOrderDetails);
