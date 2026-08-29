let adminToken = localStorage.getItem('origami_admin_token') || '';
let currentEditingProductId = null;
let currentEditingPageData = null;
let debounceTimer = null;

function showToast(message, isSuccess = true) {
  const toast = document.getElementById('admin-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');

  if (!toast || !msgEl) return;
  msgEl.innerText = message;
  if (iconEl) iconEl.innerText = isSuccess ? '✓' : '⚠️';
  toast.className = `fixed bottom-6 right-6 z-50 ${isSuccess ? 'bg-slate-900 border-emerald-500' : 'bg-rose-900 border-rose-500'} text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition transform duration-300`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function showAdminToast(message, isSuccess = true) {
  return showToast(message, isSuccess);
}

function getAuthHeaders(isJson = true) {
  const headers = {
    'Authorization': `Bearer ${adminToken || ''}`,
    'x-admin-token': adminToken || '',
    'x-auth-token': adminToken || ''
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function triggerRelogin(msg = 'Please sign in with your admin password.') {
  localStorage.removeItem('origami_admin_token');
  adminToken = '';
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('hidden');
  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.innerText = msg;
    errorEl.classList.remove('hidden');
  }
}

// Authentication Flow (Optimistic + Silent Verify)
async function checkAuth() {
  const modal = document.getElementById('login-modal');
  if (!adminToken) {
    if (modal) modal.classList.remove('hidden');
    return;
  }

  // If token exists, load admin data immediately for instant responsive UX
  if (modal) modal.classList.add('hidden');
  initAdminData();

  try {
    const res = await fetch('/api/admin/verify', { headers: getAuthHeaders() });
    if (res.status === 401) {
      triggerRelogin('Session expired. Please sign in again.');
      return;
    }
  } catch (err) {
    // Keep local data loaded if offline or slow network
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const passInput = document.getElementById('admin-pass-input');
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passInput.value.trim() })
    });

    const data = await res.json();
    if (data.success && data.token) {
            adminToken = data.token;
      localStorage.setItem('origami_admin_token', adminToken);
      document.cookie = 'origami_admin_token=' + encodeURIComponent(adminToken) + '; path=/; max-age=2592000; SameSite=Lax';
      document.getElementById('login-modal').classList.add('hidden');
      initAdminData();
      showToast('Sign in successful! 🎉');
    } else {
      errorEl.innerText = data.error || 'Invalid password!';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.innerText = 'Cannot connect to the server.';
    errorEl.classList.remove('hidden');
  }
}

function logoutAdmin() {
  localStorage.removeItem('origami_admin_token');
  adminToken = '';
  location.reload();
}

// Tab Switcher
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-emerald-600', 'text-white', 'shadow-sm');
    btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
  });

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-emerald-600', 'text-white', 'shadow-sm');
    activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
  }

  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  const activePane = document.getElementById(`tab-content-${tabName}`);
  if (activePane) {
    activePane.classList.remove('hidden');
  }

  if (tabName === 'orders') fetchOrders();
  if (tabName === 'products') fetchProducts();
  if (tabName === 'editor') loadEditorProductsList();
  if (tabName === 'settings') loadSettings();
}

function initAdminData() {
  fetchOrders();
  fetchProducts();
  loadEditorProductsList();
  loadSettings();
}

/* ========================================================
   TAB 1: ORDERS & PATHAO DISPATCH
   ======================================================== */
function debounceFetchOrders() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchOrders, 300);
}

async function fetchOrders() {
  try {
    const search = document.getElementById('order-search-input')?.value || '';
    const status = document.getElementById('order-status-filter')?.value || 'all';

    const res = await fetch(`/api/admin/orders?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&admin_token=${encodeURIComponent(adminToken)}`, {
      headers: getAuthHeaders()
    });

    if (res.status === 401) return logoutAdmin();

    const data = await res.json();
    if (!data.success) return;

    // Render Stats
    const stats = data.stats || {};
    document.getElementById('stat-total-orders').innerText = stats.total || 0;
    document.getElementById('stat-pending-orders').innerText = stats.pending || 0;
    document.getElementById('stat-confirmed-orders').innerText = stats.confirmed || 0;
    document.getElementById('stat-dispatched-orders').innerText = stats.dispatched || 0;
    document.getElementById('stat-delivered-orders').innerText = stats.delivered || 0;
    document.getElementById('stat-total-revenue').innerText = `৳${(stats.revenue || 0).toLocaleString()}`;

    // Render Orders Table
    const tbody = document.getElementById('orders-tbody');
    const emptyMsg = document.getElementById('orders-empty-msg');

    if (!data.orders || data.orders.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.classList.remove('hidden');
      return;
    }

    emptyMsg.classList.add('hidden');
    tbody.innerHTML = data.orders.map(o => {
      const isDispatched = !!o.pathao_consignment_id;
      const formattedDate = new Date(o.created_at).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-4 align-top">
            <div class="font-extrabold text-slate-900 font-latin">${o.order_number}</div>
            <div class="text-xs text-slate-400 mt-0.5">${formattedDate}</div>
            <div class="mt-1">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${o.delivery_zone === 'dhaka_inside' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}">
                ${o.delivery_zone === 'dhaka_inside' ? 'Inside Dhaka' : 'Outside Dhaka'}
              </span>
            </div>
          </td>

          <td class="p-4 align-top">
            <div class="font-bold text-slate-800">${o.customer_name}</div>
            <div class="text-xs font-semibold text-slate-600 font-latin mt-0.5">
              <a href="tel:${o.phone}" class="text-emerald-600 hover:underline">📞 ${o.phone}</a>
              <a href="https://wa.me/88${o.phone}" target="_blank" class="ml-2 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">WhatsApp</a>
            </div>
            <div class="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">${o.address}</div>
          </td>

          <td class="p-4 align-top">
            <div class="font-bold text-slate-800 text-xs sm:text-sm">${o.product_name || 'Polygons 3-in-1 Spoon'}</div>
            <div class="text-xs text-emerald-700 font-semibold mt-0.5">${o.bundle_name || 'Standard Package'}</div>
            <div class="mt-1.5">
              <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                o.color_variant === 'Black' ? 'bg-slate-900 text-white' :
                o.color_variant === 'Mixed' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                'bg-rose-100 text-rose-800 border border-rose-200'
              }">
                ${o.color_variant === 'Black' ? '⚫ Black' : o.color_variant === 'Mixed' ? '🎨 Mixed Combo' : '🔴 Maroon Red'}
              </span>
            </div>
          </td>

          <td class="p-4 align-top">
            <div class="text-base font-black text-slate-900 font-latin">৳${o.total_amount}</div>
            <div class="text-[11px] text-slate-400 font-latin">Item: ৳${o.item_price} + Delivery: ৳${o.delivery_charge}</div>
          </td>

          <td class="p-4 align-top">
            <select onchange="updateOrderStatus(${o.id}, this.value)" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none ${
              o.order_status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-300' :
              o.order_status === 'confirmed' ? 'bg-blue-50 text-blue-800 border-blue-300' :
              o.order_status === 'dispatched' ? 'bg-purple-50 text-purple-800 border-purple-300' :
              o.order_status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
              'bg-slate-100 text-slate-700'
            }">
              <option value="pending" ${o.order_status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
              <option value="confirmed" ${o.order_status === 'confirmed' ? 'selected' : ''}>✓ Confirmed</option>
              <option value="dispatched" ${o.order_status === 'dispatched' ? 'selected' : ''}>🚚 Dispatched</option>
              <option value="delivered" ${o.order_status === 'delivered' ? 'selected' : ''}>🎉 Delivered</option>
              <option value="cancelled" ${o.order_status === 'cancelled' ? 'selected' : ''}>✕ Cancelled</option>
            </select>
          </td>

          <td class="p-4 align-top text-center">
            ${isDispatched ? `
              <div class="bg-purple-50 border border-purple-200 rounded-xl p-2 text-left space-y-1">
                <span class="text-[10px] text-purple-700 font-bold block uppercase tracking-wider">Pathao Consignment</span>
                <span class="text-xs font-extrabold text-slate-900 font-latin block">${o.pathao_consignment_id}</span>
                <span class="text-[11px] text-slate-500 font-latin block">Trk: ${o.pathao_tracking_code || o.pathao_consignment_id}</span>
              </div>
            ` : `
              <button onclick="dispatchOrderToPathao(${o.id})" class="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl shadow-xs flex items-center justify-center gap-1 w-full transition">
                <span>🚚 Pathao Dispatch</span>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Order status updated successfully!');
      fetchOrders();
    } else {
      showToast(data.error || 'Failed to update status', false);
    }
  } catch (err) {
    showToast('Server error!', false);
  }
}

function setOrderStatusFilter(status) {
  const filterEl = document.getElementById('order-status-filter');
  if (filterEl) {
    filterEl.value = status;
    fetchOrders();
  }
}

async function dispatchOrderToPathao(orderId) {
  if (!confirm('Are you sure you want to dispatch this order to Pathao Courier?')) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/dispatch-pathao`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✅ Pathao Consignment Created! ID: ${data.consignment_id}`);
      // Automatically show 'all' orders so the newly dispatched order remains 100% visible with its tracking code badge!
      const filterEl = document.getElementById('order-status-filter');
      if (filterEl && filterEl.value === 'pending') {
        filterEl.value = 'all';
      }
      fetchOrders();
    } else {
      alert(`Pathao Error: ${data.error || 'Failed to dispatch'}`);
    }
  } catch (err) {
    alert('Failed to dispatch order to Pathao Courier.');
  }
}

/* ========================================================
   TAB 2: PRODUCTS & URL LINKS
   ======================================================== */
async function fetchProducts() {
  try {
    const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
    if (res.status === 401) return logoutAdmin();

    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('products-tbody');
    const origin = window.location.origin;

    tbody.innerHTML = data.products.map(p => {
      const pageUrl = `${origin}/p/${p.slug}`;
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-4 font-bold text-slate-900">
            <div class="text-base">${p.title}</div>
            <div class="text-xs text-slate-400 font-latin">Slug: ${p.slug}</div>
          </td>

          <td class="p-4 font-latin">
            <div class="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 max-w-md">
              <span class="text-xs text-slate-600 truncate flex-1">${pageUrl}</span>
              <button onclick="copyToClipboard('${pageUrl}')" class="bg-white hover:bg-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 transition flex items-center gap-1 flex-shrink-0">
                📋 Copy Link
              </button>
            </div>
          </td>

          <td class="p-4">
            ${p.is_default ? `
              <span class="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
                ⭐ Homepage (Root URL /)
              </span>
            ` : `
              <button onclick="setDefaultProduct(${p.id})" class="text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-3 py-1 rounded-full border border-slate-200 transition">
                Set as Default
              </button>
            `}
          </td>

          <td class="p-4 text-right space-x-1">
            <a href="/p/${p.slug}" target="_blank" class="inline-block bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl transition">
              👁️ View
            </a>
            <button onclick="openEditorForProduct(${p.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition">
              ✏️ Edit Page
            </button>
            ${!p.is_default ? `
              <button onclick="deleteProduct(${p.id})" class="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-2.5 py-1.5 rounded-xl transition">
                🗑️
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Landing page link copied to clipboard!');
}

function openNewProductModal() {
  document.getElementById('new-product-modal').classList.remove('hidden');
}

function closeNewProductModal() {
  document.getElementById('new-product-modal').classList.add('hidden');
}

async function setDefaultProduct(productId) {
  try {
    const res = await fetch(`/api/admin/products/${productId}/set-default`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Homepage default product set successfully!');
      fetchProducts();
    }
  } catch (err) {
    showToast('Failed to set default product', false);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product and its landing page?')) return;
  try {
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Product deleted successfully');
      fetchProducts();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Failed to delete product');
  }
}

/* ==========================================
   TAB 3: SECTION-BY-SECTION CMS EDITOR
   ========================================== */
async function loadEditorProductsList() {
  try {
    const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!data.success || !data.products) return;

    const selectEl = document.getElementById('editor-product-select');
    selectEl.innerHTML = data.products.map(p => `
      <option value="${p.id}" ${currentEditingProductId == p.id ? 'selected' : ''}>
        ${p.is_default ? '⭐ [Homepage Default] ' : ''}${p.title} (${p.slug})
      </option>
    `).join('');

    const defaultProd = data.products.find(p => p.is_default);
    const targetId = currentEditingProductId || (defaultProd ? defaultProd.id : data.products[0]?.id);
    if (targetId) {
      loadProductIntoEditor(targetId);
    }
  } catch (err) {
    console.error(err);
  }
}

function openEditorForProduct(productId) {
  currentEditingProductId = productId;
  switchTab('editor');
}

async function loadProductIntoEditor(productId) {
  currentEditingProductId = productId;
  try {
    const res = await fetch(`/api/admin/products/${productId}?_t=${Date.now()}`, { cache: "no-store", headers: getAuthHeaders() });
    const data = await res.json();
    if (!data.success || !data.product) return;

    currentEditingPageData = data.product.page_data;
    
    // Update live preview link
    const previewBtn = document.getElementById('editor-view-live-btn');
    if (previewBtn) {
      previewBtn.href = data.product.is_default ? '/' : `/p/${data.product.slug}`;
    }

    populateEditorFields(currentEditingPageData);
  } catch (err) {
    console.error('Error loading product data into editor:', err);
  }
}

async function setQuickImage(targetInputId, previewImgId, url) {
  const inputEl = document.getElementById(targetInputId);
  const imgEl = document.getElementById(previewImgId);
  if (inputEl) inputEl.value = url;
  if (imgEl) imgEl.src = url;
  await saveCurrentPageData();
  showToast('Image updated & saved! 🎉');
}

function populateEditorFields(d) {
  if (!d) return;
  if (!d.meta) d.meta = {};
  if (!d.topBar) d.topBar = {};
  if (!d.hero) d.hero = {};
  if (!d.problemSolution) d.problemSolution = { cards: [] };
  if (!d.videoDemo) d.videoDemo = {};
  if (!d.checkout) d.checkout = {};
  if (!d.bundles) d.bundles = [];
  if (!d.reviews) d.reviews = [];
  if (!d.faq) d.faq = [];

  // 1. Meta
  if (document.getElementById('edit-meta-title')) document.getElementById('edit-meta-title').value = d.meta?.pageTitle || '';
  if (document.getElementById('edit-meta-pixel')) document.getElementById('edit-meta-pixel').value = d.meta?.pixelId || '';

  // 2. Top bar
  if (document.getElementById('edit-topbar-text')) document.getElementById('edit-topbar-text').value = d.topBar?.text || '';
  if (document.getElementById('edit-topbar-show')) document.getElementById('edit-topbar-show').value = d.topBar?.show ? 'true' : 'false';

  // 3. Hero
  document.getElementById('edit-hero-badge').value = d.hero?.badge || '';
  document.getElementById('edit-hero-headline').value = d.hero?.headline || '';
  document.getElementById('edit-hero-subheadline').value = d.hero?.subheadline || '';
  document.getElementById('edit-hero-discount-price').value = d.hero?.discountedPrice || 550;
  document.getElementById('edit-hero-regular-price').value = d.hero?.regularPrice || 950;
  document.getElementById('edit-hero-discount-badge').value = d.hero?.discountBadge || '';
  document.getElementById('edit-hero-rating').value = d.hero?.ratingText || '';
  document.getElementById('edit-hero-cta').value = d.hero?.ctaText || '';
  
  // Primary Image 1
  const heroMedia1 = d.hero?.mediaUrl || '/images/post1.jpeg';
  document.getElementById('edit-hero-media-url').value = heroMedia1;
  document.getElementById('hero-preview-img').src = heroMedia1;
  const show1 = d.hero?.showPrimary !== false;
  if (document.getElementById('edit-hero-show-1')) {
    document.getElementById('edit-hero-show-1').checked = show1;
    const label1 = document.getElementById('label-hero-show-1');
    if (label1) label1.innerText = show1 ? '👁️ Shown on Site' : '🚫 Hidden on Site';
  }

  // Secondary Image 2
  const heroMedia2 = d.hero?.secondaryMediaUrl || '/images/post2.png';
  document.getElementById('edit-hero-sec-media-url').value = heroMedia2;
  document.getElementById('hero-sec-preview-img').src = heroMedia2;
  const show2 = d.hero?.showSecondary !== false;
  if (document.getElementById('edit-hero-show-2')) {
    document.getElementById('edit-hero-show-2').checked = show2;
    const label2 = document.getElementById('label-hero-show-2');
    if (label2) label2.innerText = show2 ? '👁️ Shown on Site' : '🚫 Hidden on Site';
  }

  // Additional Gallery Items
  if (!Array.isArray(d.hero?.additionalGallery)) {
    d.hero.additionalGallery = [];
  }
  renderHeroGalleryEditor();

  // 4. Problem vs Solution
  document.getElementById('edit-probsol-title').value = d.problemSolution?.title || '';
  const probsolContainer = document.getElementById('probsol-cards-editor');
  probsolContainer.innerHTML = (d.problemSolution?.cards || []).map((card, i) => `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
      <h5 class="font-bold text-xs text-slate-600">Card #${i + 1}</h5>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="text" id="edit-prob-title-${i}" value="${card.problemTitle}" placeholder="Problem Title" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
        <input type="text" id="edit-sol-title-${i}" value="${card.solutionTitle}" placeholder="Solution Title" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <textarea id="edit-prob-desc-${i}" rows="2" placeholder="Problem Description" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs">${card.problemDesc}</textarea>
        <textarea id="edit-sol-desc-${i}" rows="2" placeholder="Solution Description" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs">${card.solutionDesc}</textarea>
      </div>
    </div>
  `).join('');

  // 5. Video Demo Section
  if (!d.videoDemo) {
    d.videoDemo = {
      badge: "🎥 ভিডিও ডেমোস্ট্রেশন",
      title: "ভিডিওতে দেখুন এটি কীভাবে কাজ করে ও সহজে ব্যবহার করবেন",
      subtitle: "মাত্র কয়েক সেকেন্ডে নিখুঁত পরিমাপ ও ব্যবহারের সহজ পদ্ধতি সরাসরি ভিডিওতে দেখে নিন",
      videoUrl: "/uploads/media-1787674998296-587000979.mp4",
      posterUrl: "/uploads/media-1787681475090-937220178.webp"
    };
  }
  if (document.getElementById('edit-video-badge')) document.getElementById('edit-video-badge').value = d.videoDemo.badge || '';
  if (document.getElementById('edit-video-title')) document.getElementById('edit-video-title').value = d.videoDemo.title || '';
  if (document.getElementById('edit-video-subtitle')) document.getElementById('edit-video-subtitle').value = d.videoDemo.subtitle || '';
  if (document.getElementById('edit-video-url')) document.getElementById('edit-video-url').value = d.videoDemo.videoUrl || '';
  if (document.getElementById('edit-video-poster')) document.getElementById('edit-video-poster').value = d.videoDemo.posterUrl || '';
  const pImg = document.getElementById('video-poster-preview-img'); if (pImg && d.videoDemo.posterUrl) pImg.src = d.videoDemo.posterUrl;
  previewAdminVideo();

  // 6. What's in 1 Set Box (১ সেটে কী কী পাচ্ছেন)
  if (!d.whatsIncluded) {
    d.whatsIncluded = {
      badge: "1 Set Complete Box (Gift Packaging)",
      title: "আমাদের ১ সেট প্রোডাক্টে কী কী পাচ্ছেন?",
      subtitle: "প্রতি ১ সেটে থাকবে মোট ২টি স্মার্ট ফোল্ডিং চামচ — যা একসাথে রিপ্লেস করবে ৬টি ট্র্যাডিশনাল মেজারিং চামচ",
      largeSpoonTitle: "১. বড় মেজারিং চামচ (Tablespoon)",
      largeSpoonBadge: "৩টি মাপ (Tbsp)",
      largeSpoonUsage: "২ Tbsp (৩০ মিলি), ১ Tbsp (১৫ মিলি), ১/২ Tbsp (৭.৫ মিলি) — তেল, ময়দা ও চিনির মাপের জন্য।",
      smallSpoonTitle: "২. ছোট মেজারিং চামচ (Teaspoon)",
      smallSpoonBadge: "৩টি মাপ (tsp)",
      smallSpoonUsage: "১ tsp (৫ মিলি), ১/২ tsp (২.৫ মিলি), ১/৪ tsp (১.২৫ মিলি) — মসলা, লবণ ও ওষুধের সঠিক মাপ।",
      bannerTitle: "মোট ৬টি ভিন্ন পরিমাপ মাত্র ২টি ফ্ল্যাট চামচে!",
      bannerDesc: "কোনো বাড়তি বাটি বা ৬টি আলাদা চামচের ঝামেলা ছাড়াই ড্রয়ারে বা ম্যাগনেটিক স্ট্রিপে ফ্ল্যাট রেখে দিন।"
    };
  }
  if (document.getElementById('edit-included-title')) document.getElementById('edit-included-title').value = d.whatsIncluded.title || '';
  if (document.getElementById('edit-included-subtitle')) document.getElementById('edit-included-subtitle').value = d.whatsIncluded.subtitle || '';
  if (document.getElementById('edit-included-large-title')) document.getElementById('edit-included-large-title').value = d.whatsIncluded.largeSpoonTitle || '';
  if (document.getElementById('edit-included-large-badge')) document.getElementById('edit-included-large-badge').value = d.whatsIncluded.largeSpoonBadge || '';
  if (document.getElementById('edit-included-large-usage')) document.getElementById('edit-included-large-usage').value = d.whatsIncluded.largeSpoonUsage || '';
  if (document.getElementById('edit-included-small-title')) document.getElementById('edit-included-small-title').value = d.whatsIncluded.smallSpoonTitle || '';
  if (document.getElementById('edit-included-small-badge')) document.getElementById('edit-included-small-badge').value = d.whatsIncluded.smallSpoonBadge || '';
  if (document.getElementById('edit-included-small-usage')) document.getElementById('edit-included-small-usage').value = d.whatsIncluded.smallSpoonUsage || '';
  if (document.getElementById('edit-included-banner-title')) document.getElementById('edit-included-banner-title').value = d.whatsIncluded.bannerTitle || '';
  if (document.getElementById('edit-included-banner-desc')) document.getElementById('edit-included-banner-desc').value = d.whatsIncluded.bannerDesc || '';

  // 7. Unified Package Offers & Checkout Section
  if (!d.checkout) d.checkout = {};
  if (document.getElementById('edit-checkout-title')) {
    document.getElementById('edit-checkout-title').value = d.checkout.title || 'আপনার পছন্দের প্যাকেজটি বেছে নিন';
  }
  if (document.getElementById('edit-checkout-subtitle')) {
    document.getElementById('edit-checkout-subtitle').value = d.checkout.subtitle || '২ বা ৩ সেটের অর্ডারে থাকছে সারাদেশে ১০০% ফ্রি হোম ডেলিভারি';
  }

  const bundlesContainer = document.getElementById('bundles-editor-container');
  bundlesContainer.innerHTML = (d.bundles || []).map((b, i) => `
    <div class="bundle-editor-item bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="font-black text-slate-800 text-xs">📦 Package #${i + 1} (${b.id})</span>
        <div class="flex items-center gap-3">
          <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" id="edit-bundle-popular-${i}" ${b.isPopular ? 'checked' : ''} class="rounded text-[#D92143]" />
            <span>⭐ Highlight Best Value</span>
          </label>
          <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" id="edit-bundle-free-${i}" ${b.freeDelivery ? 'checked' : ''} class="rounded text-emerald-600" />
            <span>🚚 Free Delivery</span>
          </label>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Package Name</label>
          <input type="text" id="edit-bundle-name-${i}" value="${(b.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. 1 Set — ৳666" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Top Badge Tag</label>
          <input type="text" id="edit-bundle-badge-${i}" value="${(b.badge || '').replace(/"/g, '&quot;')}" placeholder="e.g. ⭐ Best Offer + Free Delivery" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#D92143] bg-white" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Price (৳)</label>
          <input type="number" id="edit-bundle-price-${i}" value="${b.price || 0}" placeholder="Price (৳)" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-latin font-bold bg-white" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Savings Text</label>
          <input type="text" id="edit-bundle-savings-${i}" value="${(b.savings || '').replace(/"/g, '&quot;')}" placeholder="e.g. ৳534 Discount (45% OFF)" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white" />
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-600 mb-1">Description / Items Included</label>
        <input type="text" id="edit-bundle-desc-${i}" value="${(b.desc || '').replace(/"/g, '&quot;')}" placeholder="Package Description" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white" />
      </div>
    </div>
  `).join('');

  // 8. Delivery Charges
  document.getElementById('edit-delivery-dhaka').value = d.checkout?.deliveryDhaka || 70;
  document.getElementById('edit-delivery-outside').value = d.checkout?.deliveryOutside || 130;

  // 9. Customer Reviews
  renderReviewsEditor(d);

  // 10. FAQs
  const isFaqOn = d.showFaq !== false && d.faqShow !== false;
  updateFaqToggleUI(isFaqOn);
  renderFaqEditor(d);
}

function syncReviewsFromDOM() {
  const container = document.getElementById('reviews-editor-container');
  if (!container) return currentEditingPageData?.reviews || [];
  
  const items = container.querySelectorAll('.review-editor-item');
  const reviews = [];
  items.forEach((item, i) => {
    const nameEl = document.getElementById(`edit-rev-name-${i}`);
    const locEl = document.getElementById(`edit-rev-loc-${i}`);
    const ratingEl = document.getElementById(`edit-rev-rating-${i}`);
    const verifiedEl = document.getElementById(`edit-rev-verified-${i}`);
    const dateEl = document.getElementById(`edit-rev-date-${i}`);
    const commentEl = document.getElementById(`edit-rev-comment-${i}`);

    const name = nameEl ? nameEl.value.trim() : '';
    const location = locEl ? locEl.value.trim() : '';
    const rating = ratingEl ? (Number(ratingEl.value) || 5) : 5;
    const verified = verifiedEl ? verifiedEl.checked : true;
    const date = dateEl ? dateEl.value.trim() : '';
    const comment = commentEl ? commentEl.value.trim() : '';

    if (name || comment) {
      reviews.push({ name, location, rating, verified, date, comment });
    }
  });

  if (currentEditingPageData) {
    currentEditingPageData.reviews = reviews;
  }
  return reviews;
}

function renderReviewsEditor(d) {
  const reviewsContainer = document.getElementById('reviews-editor-container');
  if (!reviewsContainer) return;
  
  const revList = Array.isArray(d.reviews) ? d.reviews : [];

  reviewsContainer.innerHTML = `
    <div class="space-y-3">
      ${revList.map((rev, i) => `
        <div class="review-editor-item bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 relative shadow-2xs">
          <div class="flex items-center justify-between pb-1 border-b border-slate-200">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>⭐ Review #${i + 1}</span>
            </span>
            <button type="button" onclick="deleteReview(${i})" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 transition hover:bg-rose-100">
              ✕ Delete
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div class="sm:col-span-4">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">Customer Name</label>
              <input type="text" id="edit-rev-name-${i}" value="${(rev.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Tanvir Ahmed" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white" />
            </div>

            <div class="sm:col-span-3">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">Location / City</label>
              <input type="text" id="edit-rev-loc-${i}" value="${(rev.location || '').replace(/"/g, '&quot;')}" placeholder="e.g. Dhanmondi, Dhaka" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">Rating</label>
              <select id="edit-rev-rating-${i}" class="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-bold">
                <option value="5" ${(rev.rating === 5 || !rev.rating) ? 'selected' : ''}>★★★★★ (5)</option>
                <option value="4" ${rev.rating === 4 ? 'selected' : ''}>★★★★☆ (4)</option>
                <option value="3" ${rev.rating === 3 ? 'selected' : ''}>★★★☆☆ (3)</option>
                <option value="2" ${rev.rating === 2 ? 'selected' : ''}>★★☆☆☆ (2)</option>
                <option value="1" ${rev.rating === 1 ? 'selected' : ''}>★☆☆☆☆ (1)</option>
              </select>
            </div>

            <div class="sm:col-span-3">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">Date</label>
              <input type="text" id="edit-rev-date-${i}" value="${(rev.date || '').replace(/"/g, '&quot;')}" placeholder="e.g. 3 days ago" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">Review Comment</label>
            <textarea id="edit-rev-comment-${i}" rows="2" placeholder="Write detailed customer review feedback here..." class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white">${rev.comment || ''}</textarea>
          </div>

          <div class="flex items-center gap-2 pt-0.5">
            <input type="checkbox" id="edit-rev-verified-${i}" ${rev.verified !== false ? 'checked' : ''} class="rounded text-emerald-600 w-3.5 h-3.5" />
            <label for="edit-rev-verified-${i}" class="text-[11px] font-bold text-slate-600 cursor-pointer">
              ✓ Show Verified Customer Badge
            </label>
          </div>
        </div>
      `).join('')}

      <button type="button" onclick="addReviewItem()" class="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl border-2 border-dashed border-slate-300 transition flex items-center justify-center gap-2 hover:border-slate-400 shadow-2xs">
        <span class="text-emerald-600 font-black text-sm">➕</span>
        <span>+ Add New Customer Review</span>
      </button>
    </div>
  `;
}

function addReviewItem() {
  if (!currentEditingPageData) return;
  syncReviewsFromDOM();
  if (!currentEditingPageData.reviews) currentEditingPageData.reviews = [];
  currentEditingPageData.reviews.push({
    name: "Verified Customer",
    location: "Dhaka",
    rating: 5,
    verified: true,
    date: "Just now",
    comment: "The folding measuring spoon is very handy, sturdy, and easy to clean. Highly recommended!"
  });
  renderReviewsEditor(currentEditingPageData);
}

function deleteReview(index) {
  if (!currentEditingPageData) return;
  syncReviewsFromDOM();
  if (!currentEditingPageData.reviews) return;
  currentEditingPageData.reviews.splice(index, 1);
  renderReviewsEditor(currentEditingPageData);
}

function syncFaqsFromDOM() {
  const container = document.getElementById('faq-editor-container');
  if (!container) return currentEditingPageData?.faq || [];
  
  const items = container.querySelectorAll('.faq-editor-item');
  const faqs = [];
  items.forEach((item, i) => {
    const qEl = document.getElementById(`edit-faq-q-${i}`);
    const aEl = document.getElementById(`edit-faq-a-${i}`);
    const q = qEl ? qEl.value.trim() : '';
    const a = aEl ? aEl.value.trim() : '';
    if (q || a) {
      faqs.push({ question: q, answer: a, q, a });
    }
  });

  if (currentEditingPageData) {
    currentEditingPageData.faq = faqs;
  }
  return faqs;
}

function renderFaqEditor(d) {
  const faqContainer = document.getElementById('faq-editor-container');
  if (!faqContainer) return;

  const faqList = Array.isArray(d.faq) ? d.faq : [];

  faqContainer.innerHTML = `
    <div class="space-y-3">
      ${faqList.map((f, i) => `
        <div class="faq-editor-item bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 relative shadow-2xs">
          <div class="flex items-center justify-between pb-1 border-b border-slate-200">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>❓ FAQ #${i + 1}</span>
            </span>
            <button type="button" onclick="deleteFaq(${i})" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 transition hover:bg-rose-100">
              ✕ Delete
            </button>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">Question</label>
            <input type="text" id="edit-faq-q-${i}" value="${(f.question || f.q || '').replace(/"/g, '&quot;')}" placeholder="Question" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">Answer</label>
            <textarea id="edit-faq-a-${i}" rows="2" placeholder="Answer" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white">${f.answer || f.a || ''}</textarea>
          </div>
        </div>
      `).join('')}

      <button type="button" onclick="addFaqItem()" class="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl border-2 border-dashed border-slate-300 transition flex items-center justify-center gap-2 hover:border-slate-400 shadow-2xs">
        <span class="text-emerald-600 font-black text-sm">➕</span>
        <span>+ Add New FAQ Item</span>
      </button>
    </div>
  `;
}

function addFaqItem() {
  if (!currentEditingPageData) return;
  syncFaqsFromDOM();
  if (!currentEditingPageData.faq) currentEditingPageData.faq = [];
  currentEditingPageData.faq.push({
    question: "How do I fold and use the spoon?",
    answer: "Simply pinch along the engraved measurement lines to fold into the required spoon volume.",
    q: "How do I fold and use the spoon?",
    a: "Simply pinch along the engraved measurement lines to fold into the required spoon volume."
  });
  renderFaqEditor(currentEditingPageData);
}

function deleteFaq(index) {
  if (!currentEditingPageData) return;
  syncFaqsFromDOM();
  if (!currentEditingPageData.faq) return;
  currentEditingPageData.faq.splice(index, 1);
  renderFaqEditor(currentEditingPageData);
}

function updateFaqToggleUI(isChecked) {
  const checkbox = document.getElementById('edit-faq-show');
  const label = document.getElementById('label-faq-show');
  const btnContainer = document.getElementById('label-faq-toggle-btn');
  const editorContainer = document.getElementById('faq-editor-container');

  if (checkbox) checkbox.checked = isChecked;
  if (label) {
    label.innerText = isChecked ? '👁️ Section ON (Visible)' : '🚫 Section OFF (Hidden)';
  }
  if (btnContainer) {
    if (isChecked) {
      btnContainer.className = 'flex items-center gap-2 text-xs font-bold cursor-pointer select-none px-3.5 py-1.5 rounded-xl border transition shadow-2xs bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100';
    } else {
      btnContainer.className = 'flex items-center gap-2 text-xs font-bold cursor-pointer select-none px-3.5 py-1.5 rounded-xl border transition shadow-2xs bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100';
    }
  }
  if (editorContainer) {
    if (isChecked) {
      editorContainer.classList.remove('opacity-75');
    } else {
      editorContainer.classList.add('opacity-75');
    }
  }
}

async function toggleFaqSectionShow(isChecked) {
  if (!currentEditingPageData) return;
  currentEditingPageData.showFaq = isChecked;
  currentEditingPageData.faqShow = isChecked;
  updateFaqToggleUI(isChecked);
  await saveCurrentPageData();
  showToast(isChecked ? 'FAQ section is now ON (Visible on landing page) 👁️' : 'FAQ section is now OFF (Hidden from landing page) 🚫');
}

async function toggleHeroPrimaryShow(isChecked) {
  if (!currentEditingPageData?.hero) return;
  currentEditingPageData.hero.showPrimary = isChecked;
  const label = document.getElementById('label-hero-show-1');
  if (label) label.innerText = isChecked ? '👁️ Shown on Site' : '🚫 Hidden on Site';
  await saveCurrentPageData();
  showToast(isChecked ? 'Primary image is now VISIBLE on site 👁️' : 'Primary image is now HIDDEN on site 🚫');
}

async function toggleHeroSecondaryShow(isChecked) {
  if (!currentEditingPageData?.hero) return;
  currentEditingPageData.hero.showSecondary = isChecked;
  const label = document.getElementById('label-hero-show-2');
  if (label) label.innerText = isChecked ? '👁️ Shown on Site' : '🚫 Hidden on Site';
  await saveCurrentPageData();
  showToast(isChecked ? 'Secondary image is now VISIBLE on site 👁️' : 'Secondary image is now HIDDEN on site 🚫');
}

// Synchronize all Hero Image inputs before reordering or saving
function syncHeroInputsToData() {
  if (!currentEditingPageData?.hero) return;
  const h = currentEditingPageData.hero;
  const pInput = document.getElementById('edit-hero-media-url');
  if (pInput) h.mediaUrl = pInput.value.trim();
  const sInput = document.getElementById('edit-hero-sec-media-url');
  if (sInput) h.secondaryMediaUrl = sInput.value.trim();
}

function populateHeroImageFields(h) {
  if (!h) return;
  const pInput = document.getElementById('edit-hero-media-url');
  const pImg = document.getElementById('hero-preview-img');
  const pCheck = document.getElementById('edit-hero-show-1');
  const pLabel = document.getElementById('label-hero-show-1');

  if (pInput) pInput.value = h.mediaUrl || '';
  if (pImg) pImg.src = h.mediaUrl || '/images/post1.jpeg';
  if (pCheck) pCheck.checked = h.showPrimary !== false;
  if (pLabel) pLabel.innerText = h.showPrimary !== false ? '👁️ Shown on Site' : '🚫 Hidden on Site';

  const sInput = document.getElementById('edit-hero-sec-media-url');
  const sImg = document.getElementById('hero-sec-preview-img');
  const sCheck = document.getElementById('edit-hero-show-2');
  const sLabel = document.getElementById('label-hero-show-2');

  if (sInput) sInput.value = h.secondaryMediaUrl || '';
  if (sImg) sImg.src = h.secondaryMediaUrl || '/images/post2.png';
  if (sCheck) sCheck.checked = h.showSecondary !== false;
  if (sLabel) sLabel.innerText = h.showSecondary !== false ? '👁️ Shown on Site' : '🚫 Hidden on Site';
}

// Move Any Image Up or Down Across Entire Showcase List
async function moveHeroImage(fromIndex, offset) {
  if (!currentEditingPageData?.hero) return;
  const h = currentEditingPageData.hero;
  syncHeroInputsToData();

  const allImages = [
    { url: h.mediaUrl || '/images/post1.jpeg', show: h.showPrimary !== false },
    { url: h.secondaryMediaUrl || '/images/post2.png', show: h.showSecondary !== false },
    ...(h.additionalGallery || []).map(item => (typeof item === 'string' ? { url: item, show: true } : { url: item.url || '', show: item.show !== false }))
  ];

  const targetIndex = fromIndex + offset;
  if (targetIndex < 0 || targetIndex >= allImages.length) return;

  // Swap positions
  const temp = allImages[fromIndex];
  allImages[fromIndex] = allImages[targetIndex];
  allImages[targetIndex] = temp;

  // Write back to current page data
  h.mediaUrl = allImages[0].url;
  h.showPrimary = allImages[0].show;

  h.secondaryMediaUrl = allImages[1].url;
  h.showSecondary = allImages[1].show;

  h.additionalGallery = allImages.slice(2);

  // Update UI and preview elements
  populateHeroImageFields(h);
  renderHeroGalleryEditor();

  // Auto-save immediately to database
  await saveCurrentPageData();
  showToast(`📸 Photo moved to Position #${targetIndex + 1}! Saved successfully! 🎉`);
}

function renderHeroGalleryEditor() {
  const container = document.getElementById('hero-gallery-editor-container');
  if (!container || !currentEditingPageData?.hero) return;

  const h = currentEditingPageData.hero;
  const gallery = h.additionalGallery || [];
  const totalCount = 2 + gallery.length;

  if (gallery.length === 0) {
    container.innerHTML = `<div class="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-semibold">No extra showcase images added. Click "+ Add Showcase Image" above to add more pictures to the gallery!</div>`;
    return;
  }

  container.innerHTML = gallery.map((item, i) => {
    const isShown = item.show !== false;
    const url = typeof item === 'string' ? item : (item.url || '');
    const currentPos = i + 3;
    const globalIndex = i + 2;

    return `
      <div class="bg-slate-50 p-4 rounded-xl border ${isShown ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'} space-y-3 transition">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="bg-[#FEF5E4] text-[#D92143] font-black text-xs px-2.5 py-1 rounded-lg border border-[#E0C375]/50">Position #${currentPos}</span>
            <span class="font-bold text-slate-800 text-xs">
              📸 Extra Showcase Image
            </span>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Move Up Button -->
            <button type="button" onclick="moveHeroImage(${globalIndex}, -1)" class="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs transition flex items-center gap-1">
              <span>⬆️ Move Up</span>
            </button>
            <!-- Move Down Button -->
            ${globalIndex < totalCount - 1 ? `
              <button type="button" onclick="moveHeroImage(${globalIndex}, 1)" class="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs transition flex items-center gap-1">
                <span>⬇️ Move Down</span>
              </button>
            ` : ''}
            <!-- Show / Hide Toggle Switch -->
            <label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700 select-none bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition">
              <input type="checkbox" id="edit-gallery-show-${i}" ${isShown ? 'checked' : ''} onchange="toggleHeroGalleryItemShow(${i}, this.checked)" class="rounded text-[#D92143] cursor-pointer" />
              <span>${isShown ? '👁️ Shown on Site' : '🚫 Hidden on Site'}</span>
            </label>
            <!-- Delete Button -->
            <button type="button" onclick="removeHeroGalleryItem(${i})" class="text-rose-600 hover:text-rose-800 text-xs font-bold transition px-1.5 py-1">
              ✕ Delete
            </button>
          </div>
        </div>

        <!-- Quick Select Shortcuts -->
        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
          <span>Quick Select:</span>
          <div class="flex items-center gap-1.5 flex-wrap font-latin">
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/hero-spoon.svg')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">hero-spoon.svg</button>
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/comp-origami.svg')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">comp-origami.svg</button>
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/post1.jpeg')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">post1.jpeg</button>
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/post2.png')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">post2.png</button>
          </div>
        </div>

        <!-- Upload & URL Input -->
        <div class="flex items-center gap-3">
          <input type="file" accept="image/*,video/*" onchange="uploadMediaFile(this, 'edit-gallery-url-${i}', 'gallery-preview-img-${i}')" class="text-xs text-slate-500" />
          <input type="text" id="edit-gallery-url-${i}" value="${url}" placeholder="/images/hero-spoon.svg" onchange="onGalleryUrlChange(${i}, this.value)" class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-latin" />
        </div>

        <!-- Image Preview -->
        <div class="pt-1">
          <img id="gallery-preview-img-${i}" src="${url || '/images/hero-spoon.svg'}" onerror="this.onerror=null; this.src='/images/post1.jpeg';" alt="Preview ${i+3}" class="h-28 w-auto rounded-xl border border-slate-200 object-contain bg-white shadow-xs" />
        </div>
      </div>
    `;
  }).join('');
}

async function addHeroGalleryItem() {
  if (!currentEditingPageData?.hero) return;
  if (!Array.isArray(currentEditingPageData.hero.additionalGallery)) {
    currentEditingPageData.hero.additionalGallery = [];
  }
  currentEditingPageData.hero.additionalGallery.push({
    url: '/images/hero-spoon.svg',
    show: true
  });
  renderHeroGalleryEditor();
  await saveCurrentPageData();
  showToast('New extra showcase image slot added! 🎉');
}

async function removeHeroGalleryItem(idx) {
  if (!currentEditingPageData?.hero?.additionalGallery) return;
  if (!confirm('Are you sure you want to remove this showcase image?')) return;
  currentEditingPageData.hero.additionalGallery.splice(idx, 1);
  renderHeroGalleryEditor();
  await saveCurrentPageData();
  showToast('Showcase image removed! 🗑️');
}

async function toggleHeroGalleryItemShow(idx, isChecked) {
  if (!currentEditingPageData?.hero?.additionalGallery?.[idx]) return;
  currentEditingPageData.hero.additionalGallery[idx].show = isChecked;
  renderHeroGalleryEditor();
  await saveCurrentPageData();
  showToast(isChecked ? 'Image is now VISIBLE on site 👁️' : 'Image is now HIDDEN on site 🚫');
}

async function onGalleryUrlChange(idx, val) {
  if (!currentEditingPageData?.hero?.additionalGallery?.[idx]) return;
  currentEditingPageData.hero.additionalGallery[idx].url = val.trim();
  const previewImg = document.getElementById(`gallery-preview-img-${idx}`);
  if (previewImg) previewImg.src = val.trim();
  await saveCurrentPageData();
}



// Universal Client-Side Image Compressor before Upload (Prevents 413 on Vercel/Cloudflare/Nginx)
async function compressImageBeforeUpload(file, maxDimension = 2000, quality = 0.88) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
            } else {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Media file upload handler
async function uploadMediaFile(inputEl, targetInputId, previewImgId) {
  if (!inputEl.files || !inputEl.files[0]) return;
  let file = inputEl.files[0];

  try {
    showToast('Optimizing & uploading image...');
    if (file.type.startsWith('image/')) {
      file = await compressImageBeforeUpload(file);
    }

    const formData = new FormData();
    formData.append('media', file);

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + (adminToken || '')
      },
      body: formData
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (res.status === 413 || text.includes('Request Entity Too Large') || text.includes('413')) {
        alert('⚠️ File size exceeds server limit (Request Entity Too Large). Please choose a smaller image.');
        return;
      }
      alert('Server Error (' + res.status + '): ' + text.substring(0, 120));
      return;
    }

    if (data.success && data.url) {
      const targetInput = document.getElementById(targetInputId);
      if (targetInput) targetInput.value = data.url;
      if (previewImgId) {
        const previewImg = document.getElementById(previewImgId);
        if (previewImg) previewImg.src = data.url;
      }
      if (typeof previewAdminVideo === 'function') {
        previewAdminVideo();
      }
      // Auto-save immediately to database
      await saveCurrentPageData();
      showToast('✅ Image uploaded and saved successfully!');
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Upload error: ' + (err.message || 'Network error'));
  } finally {
    inputEl.value = '';
  }
}

// Save all updated sections to database
async function saveCurrentPageData() {
  if (!currentEditingProductId || !currentEditingPageData) return;

  const d = currentEditingPageData;
  if (!d.meta) d.meta = {};
  if (!d.topBar) d.topBar = {};
  if (!d.hero) d.hero = {};
  if (!d.problemSolution) d.problemSolution = { cards: [] };
  if (!d.videoDemo) d.videoDemo = {};
  if (!d.checkout) d.checkout = {};
  if (!d.bundles) d.bundles = [];
  if (!d.reviews) d.reviews = [];
  if (!d.faq) d.faq = [];

  // 1. Meta
  if (document.getElementById('edit-meta-title')) d.meta.pageTitle = document.getElementById('edit-meta-title').value.trim();
  if (document.getElementById('edit-meta-pixel')) d.meta.pixelId = document.getElementById('edit-meta-pixel').value.trim();

  // 2. Top bar
  if (document.getElementById('edit-topbar-text')) d.topBar.text = document.getElementById('edit-topbar-text').value.trim();
  if (document.getElementById('edit-topbar-show')) d.topBar.show = document.getElementById('edit-topbar-show').value === 'true';

  // 3. Hero
  if (document.getElementById('edit-hero-badge')) d.hero.badge = document.getElementById('edit-hero-badge').value.trim();
  if (document.getElementById('edit-hero-headline')) d.hero.headline = document.getElementById('edit-hero-headline').value.trim();
  if (document.getElementById('edit-hero-subheadline')) d.hero.subheadline = document.getElementById('edit-hero-subheadline').value.trim();
  if (document.getElementById('edit-hero-discount-price')) d.hero.discountedPrice = Number(document.getElementById('edit-hero-discount-price').value);
  if (document.getElementById('edit-hero-regular-price')) d.hero.regularPrice = Number(document.getElementById('edit-hero-regular-price').value);
  if (document.getElementById('edit-hero-discount-badge')) d.hero.discountBadge = document.getElementById('edit-hero-discount-badge').value.trim();
  if (document.getElementById('edit-hero-rating')) d.hero.ratingText = document.getElementById('edit-hero-rating').value.trim();
  if (document.getElementById('edit-hero-cta')) d.hero.ctaText = document.getElementById('edit-hero-cta').value.trim();
  
  // Primary Image 1
  if (document.getElementById('edit-hero-media-url')) d.hero.mediaUrl = document.getElementById('edit-hero-media-url').value.trim();
  if (document.getElementById('edit-hero-show-1')) d.hero.showPrimary = document.getElementById('edit-hero-show-1').checked;

  // Secondary Image 2
  if (document.getElementById('edit-hero-sec-media-url')) d.hero.secondaryMediaUrl = document.getElementById('edit-hero-sec-media-url').value.trim();
  if (document.getElementById('edit-hero-show-2')) d.hero.showSecondary = document.getElementById('edit-hero-show-2').checked;

  // Sync Additional Gallery items from DOM
  const addGallery = [];
  (d.hero.additionalGallery || []).forEach((item, i) => {
    const urlInput = document.getElementById(`edit-gallery-url-${i}`);
    const showCheckbox = document.getElementById(`edit-gallery-show-${i}`);
    const url = urlInput ? urlInput.value.trim() : (typeof item === 'string' ? item : item.url);
    const show = showCheckbox ? showCheckbox.checked : (item.show !== false);
    if (url) {
      addGallery.push({ url, show });
    }
  });
  d.hero.additionalGallery = addGallery;

  // Keep d.hero.gallery synchronized for backwards compatibility
  const combinedList = [];
  if (d.hero.mediaUrl) combinedList.push({ url: d.hero.mediaUrl, show: d.hero.showPrimary !== false });
  if (d.hero.secondaryMediaUrl) combinedList.push({ url: d.hero.secondaryMediaUrl, show: d.hero.showSecondary !== false });
  addGallery.forEach(g => combinedList.push(g));
  d.hero.gallery = combinedList;

  // 4. Problem vs Solution
  if (document.getElementById('edit-probsol-title')) {
    d.problemSolution.title = document.getElementById('edit-probsol-title').value.trim();
  }
  (d.problemSolution.cards || []).forEach((c, i) => {
    const pt = document.getElementById(`edit-prob-title-${i}`);
    const st = document.getElementById(`edit-sol-title-${i}`);
    const pd = document.getElementById(`edit-prob-desc-${i}`);
    const sd = document.getElementById(`edit-sol-desc-${i}`);
    if (pt) c.problemTitle = pt.value.trim();
    if (st) c.solutionTitle = st.value.trim();
    if (pd) c.problemDesc = pd.value.trim();
    if (sd) c.solutionDesc = sd.value.trim();
  });

  // 5. Video Demo
  delete d.howItWorks;
  if (!d.videoDemo) d.videoDemo = {};
  if (document.getElementById('edit-video-badge')) d.videoDemo.badge = document.getElementById('edit-video-badge').value.trim();
  if (document.getElementById('edit-video-title')) d.videoDemo.title = document.getElementById('edit-video-title').value.trim();
  if (document.getElementById('edit-video-subtitle')) d.videoDemo.subtitle = document.getElementById('edit-video-subtitle').value.trim();
  if (document.getElementById('edit-video-url')) d.videoDemo.videoUrl = document.getElementById('edit-video-url').value.trim();
  if (document.getElementById('edit-video-poster')) d.videoDemo.posterUrl = document.getElementById('edit-video-poster').value.trim();

  // 6. What's Included in 1 Set Box (১ সেটে কী কী পাচ্ছেন)
  if (!d.whatsIncluded) d.whatsIncluded = {};
  if (document.getElementById('edit-included-title')) d.whatsIncluded.title = document.getElementById('edit-included-title').value.trim();
  if (document.getElementById('edit-included-subtitle')) d.whatsIncluded.subtitle = document.getElementById('edit-included-subtitle').value.trim();
  if (document.getElementById('edit-included-large-title')) d.whatsIncluded.largeSpoonTitle = document.getElementById('edit-included-large-title').value.trim();
  if (document.getElementById('edit-included-large-badge')) d.whatsIncluded.largeSpoonBadge = document.getElementById('edit-included-large-badge').value.trim();
  if (document.getElementById('edit-included-large-usage')) d.whatsIncluded.largeSpoonUsage = document.getElementById('edit-included-large-usage').value.trim();
  if (document.getElementById('edit-included-small-title')) d.whatsIncluded.smallSpoonTitle = document.getElementById('edit-included-small-title').value.trim();
  if (document.getElementById('edit-included-small-badge')) d.whatsIncluded.smallSpoonBadge = document.getElementById('edit-included-small-badge').value.trim();
  if (document.getElementById('edit-included-small-usage')) d.whatsIncluded.smallSpoonUsage = document.getElementById('edit-included-small-usage').value.trim();
  if (document.getElementById('edit-included-banner-title')) d.whatsIncluded.bannerTitle = document.getElementById('edit-included-banner-title').value.trim();
  if (document.getElementById('edit-included-banner-desc')) d.whatsIncluded.bannerDesc = document.getElementById('edit-included-banner-desc').value.trim();

  // 7. Unified Package Offers & Checkout Section
  if (!d.checkout) d.checkout = {};
  if (document.getElementById('edit-checkout-title')) {
    d.checkout.title = document.getElementById('edit-checkout-title').value.trim();
  }
  if (document.getElementById('edit-checkout-subtitle')) {
    d.checkout.subtitle = document.getElementById('edit-checkout-subtitle').value.trim();
  }

  (d.bundles || []).forEach((b, i) => {
    const bn = document.getElementById(`edit-bundle-name-${i}`);
    const bb = document.getElementById(`edit-bundle-badge-${i}`);
    const bp = document.getElementById(`edit-bundle-price-${i}`);
    const bs = document.getElementById(`edit-bundle-savings-${i}`);
    const bd = document.getElementById(`edit-bundle-desc-${i}`);
    const bf = document.getElementById(`edit-bundle-free-${i}`);
    const bpop = document.getElementById(`edit-bundle-popular-${i}`);
    if (bn) b.name = bn.value.trim();
    if (bb) b.badge = bb.value.trim();
    if (bp) b.price = Number(bp.value) || 0;
    if (bs) b.savings = bs.value.trim();
    if (bd) b.desc = bd.value.trim();
    if (bf) b.freeDelivery = bf.checked;
    if (bpop) b.isPopular = bpop.checked;
  });

  // 8. Delivery
  if (document.getElementById('edit-delivery-dhaka')) {
    d.checkout.deliveryDhaka = Number(document.getElementById('edit-delivery-dhaka').value);
  }
  if (document.getElementById('edit-delivery-outside')) {
    d.checkout.deliveryOutside = Number(document.getElementById('edit-delivery-outside').value);
  }

  // 9. Reviews (Directly synced from DOM inputs - completely replaces previous data)
  d.reviews = syncReviewsFromDOM();

  // 10. FAQs (Directly synced from DOM inputs - completely replaces previous data)
  d.faq = syncFaqsFromDOM();
  const faqToggleEl = document.getElementById('edit-faq-show');
  if (faqToggleEl) {
    d.showFaq = faqToggleEl.checked;
    d.faqShow = faqToggleEl.checked;
  }

  try {
    const targetId = currentEditingProductId || 1;
    const res = await fetch(`/api/admin/products/${targetId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: d.hero?.headline || d.meta?.pageTitle || 'Polygons Spoon Set',
        page_data: d
      })
    });

    if (res.status === 401) {
      triggerRelogin('Unauthorized or session expired. Please sign in to save changes.');
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ All section changes saved to live page!');
    } else {
      showToast(data.error || 'Failed to save changes', false);
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message || 'Server error!', false);
  }
}

/* ==========================================
   DATABASE BACKUP / RESTORE HELPERS
   ========================================== */
async function exportDatabase() {
  try {
    const token = getAdminToken();
    const res = await fetch('/api/admin/database/export', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error('Failed to download database backup');
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `database-backup-${Date.now()}.sqlite`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    showToast('Database snapshot downloaded successfully! 💾');
  } catch (err) {
    alert('Export error: ' + err.message);
  }
}

async function importDatabase(inputEl) {
  if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
  const file = inputEl.files[0];
  if (!confirm(`Are you sure you want to restore "${file.name}"? This will replace the current database with the uploaded backup.`)) {
    inputEl.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('database', file);

  try {
    const token = getAdminToken();
    const res = await fetch('/api/admin/database/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast('Database imported & restored successfully! 🚀');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      alert(data.error || 'Failed to restore database');
    }
  } catch (err) {
    alert('Import error: ' + err.message);
  } finally {
    inputEl.value = '';
  }
}

/* ==========================================
   TAB 4: SETTINGS
   ========================================== */
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const s = data.settings || {};
    document.getElementById('set-pathao-base-url').value = s.pathao_base_url || 'https://courier-api-sandbox.pathao.com';
    document.getElementById('set-pathao-client-id').value = s.pathao_client_id || '';
    document.getElementById('set-pathao-client-secret').value = s.pathao_client_secret || '';
    document.getElementById('set-pathao-username').value = s.pathao_username || '';
    document.getElementById('set-pathao-password').value = s.pathao_password || '';
    document.getElementById('set-pathao-store-id').value = s.pathao_store_id || '';
    document.getElementById('set-meta-pixel-id').value = s.meta_pixel_id || '';
    document.getElementById('set-meta-test-code').value = s.meta_test_event_code || '';
    document.getElementById('set-meta-capi-token').value = s.meta_capi_token || '';
    document.getElementById('set-whatsapp-number').value = s.whatsapp_number || '8801353892282';
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();

  const settings = {
    pathao_base_url: document.getElementById('set-pathao-base-url').value.trim(),
    pathao_client_id: document.getElementById('set-pathao-client-id').value.trim(),
    pathao_client_secret: document.getElementById('set-pathao-client-secret').value.trim(),
    pathao_username: document.getElementById('set-pathao-username').value.trim(),
    pathao_password: document.getElementById('set-pathao-password').value.trim(),
    pathao_store_id: document.getElementById('set-pathao-store-id').value.trim(),
    meta_pixel_id: document.getElementById('set-meta-pixel-id').value.trim(),
    meta_test_event_code: document.getElementById('set-meta-test-code').value.trim(),
    meta_capi_token: document.getElementById('set-meta-capi-token').value.trim(),
    whatsapp_number: document.getElementById('set-whatsapp-number').value.trim()
  };

  const newPass = document.getElementById('set-admin-password').value.trim();
  if (newPass) {
    settings.admin_password = newPass;
    adminToken = newPass;
    localStorage.setItem('origami_admin_token', newPass);
  }

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings)
    });

    const data = await res.json();
    if (data.success) {
      showToast('Global settings saved successfully!');
    } else {
      showToast('Failed to save settings', false);
    }
  } catch (err) {
    showToast('Server error!', false);
  }
}

// Handle Add Product Form
async function handleCreateProduct(e) {
  e.preventDefault();
  const title = document.getElementById('new-prod-title').value.trim();
  const slug = document.getElementById('new-prod-slug').value.trim();

  try {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, slug })
    });

    const data = await res.json();
    if (data.success) {
      closeNewProductModal();
      showToast(`New product landing funnel created: /p/${data.slug}`);
      fetchProducts();
    } else {
      alert(data.error || 'Could not create product');
    }
  } catch (err) {
    alert('Failed to create product funnel');
  }
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  document.getElementById('admin-login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('global-settings-form')?.addEventListener('submit', handleSaveSettings);
  document.getElementById('new-product-form')?.addEventListener('submit', handleCreateProduct);
});

// Video Demo Preview & Upload Handlers
function previewAdminVideo() {
  const previewBox = document.getElementById('admin-video-preview-box');
  if (!previewBox) return;
  const urlInput = document.getElementById('edit-video-url');
  const posterInput = document.getElementById('edit-video-poster');
  const videoUrl = urlInput ? urlInput.value.trim() : '';
  const posterUrl = posterInput ? posterInput.value.trim() : '';

  const posterPreviewImg = document.getElementById('video-poster-preview-img');
  if (posterPreviewImg && posterUrl) {
    posterPreviewImg.src = posterUrl;
  }

  if (!videoUrl) {
    previewBox.innerHTML = '<p class="text-xs text-slate-400">No video selected</p>';
    return;
  }

  const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([\w-]{11})/);
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  const gdriveMatch = videoUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);

  if (videoUrl.startsWith('<iframe') && videoUrl.includes('</iframe>')) {
    previewBox.innerHTML = videoUrl.replace('<iframe', '<iframe class="w-full h-full rounded-2xl"');
  } else if (ytMatch) {
    previewBox.innerHTML = `<iframe class="w-full h-full rounded-2xl" src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0" frameborder="0" allowfullscreen></iframe>`;
  } else if (vimeoMatch) {
    previewBox.innerHTML = `<iframe class="w-full h-full rounded-2xl" src="https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1" frameborder="0" allowfullscreen></iframe>`;
  } else if (gdriveMatch) {
    previewBox.innerHTML = `<iframe class="w-full h-full rounded-2xl" src="https://drive.google.com/file/d/${gdriveMatch[1]}/preview" frameborder="0" allow="autoplay"></iframe>`;
  } else {
    previewBox.innerHTML = `<video class="w-full h-full object-cover rounded-2xl" controls playsinline preload="metadata" ${posterUrl ? `poster="${posterUrl}"` : ''}><source src="${videoUrl}" type="video/mp4"><source src="${videoUrl}"></video>`;
  }
}

function uploadVideoFile(inputEl, targetInputId) {
  if (!inputEl.files || inputEl.files.length === 0) return;
  const file = inputEl.files[0];
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

  const targetInput = document.getElementById(targetInputId);
  const uploadBtnLabel = inputEl.closest('label');
  const origBtnHtml = uploadBtnLabel ? uploadBtnLabel.innerHTML : '';

  if (uploadBtnLabel) {
    uploadBtnLabel.classList.add('opacity-75', 'pointer-events-none');
    uploadBtnLabel.innerHTML = `<span>⏳ 0% (${fileSizeMB}MB)</span>`;
  }
  if (targetInput) targetInput.placeholder = `Uploading video... (${fileSizeMB}MB)`;

  const formData = new FormData();
  formData.append('media', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin/upload', true);
  xhr.setRequestHeader('Authorization', 'Bearer ' + (adminToken || ''));

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (uploadBtnLabel) {
        uploadBtnLabel.innerHTML = `<span>⏳ ${percent}% (${fileSizeMB}MB)</span>`;
      }
      if (targetInput) {
        targetInput.placeholder = `Uploading video... ${percent}%`;
      }
    }
  };

  xhr.onload = function() {
    if (uploadBtnLabel) {
      uploadBtnLabel.innerHTML = origBtnHtml;
      uploadBtnLabel.classList.remove('opacity-75', 'pointer-events-none');
    }
    inputEl.value = '';

    const text = xhr.responseText;
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (xhr.status === 413 || text.includes('Request Entity Too Large') || text.includes('413')) {
        alert(`⚠️ File size (${fileSizeMB}MB) exceeds server limit (413 Request Entity Too Large).\n\n💡 Easy Solutions:\n1. Paste a YouTube or Shorts link into the Video Source box (fastest & no storage limit).\n2. Or compress the video file to under 25MB before uploading.`);
        return;
      }
      alert(`Server Error (${xhr.status}): ${text.substring(0, 150)}`);
      return;
    }

    if (xhr.status === 200 && data.success && data.url) {
      if (targetInput) {
        targetInput.value = data.url;
      }
      previewAdminVideo();
      showToast('✅ Video uploaded successfully!');
      saveCurrentPageData();
    } else {
      alert('Video upload failed: ' + (data.error || 'Unknown error'));
    }
  };

  xhr.onerror = function() {
    if (uploadBtnLabel) {
      uploadBtnLabel.innerHTML = origBtnHtml;
      uploadBtnLabel.classList.remove('opacity-75', 'pointer-events-none');
    }
    inputEl.value = '';
    alert('Network connection interrupted. Video upload could not be completed.');
  };

  xhr.send(formData);
}
