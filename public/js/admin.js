let adminToken = localStorage.getItem('origami_admin_token') || '';
let currentEditingProductId = null;
let currentEditingPageData = null;
let debounceTimer = null;

function showToast(message, isSuccess = true) {
  const toast = document.getElementById('admin-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');

  msgEl.innerText = message;
  iconEl.innerText = isSuccess ? '✓' : '⚠️';
  toast.className = `fixed bottom-6 right-6 z-50 ${isSuccess ? 'bg-slate-900 border-emerald-500' : 'bg-rose-900 border-rose-500'} text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition transform duration-300`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function getAuthHeaders(isJson = true) {
  const headers = {
    'Authorization': `Bearer ${adminToken}`
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Authentication Flow
function checkAuth() {
  const modal = document.getElementById('login-modal');
  if (!adminToken) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
    initAdminData();
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
      document.getElementById('login-modal').classList.add('hidden');
      initAdminData();
      showToast('Sign in successful!');
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

    const res = await fetch(`/api/admin/orders?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`, {
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
            <div class="font-bold text-slate-800 text-xs sm:text-sm">${o.product_name || 'Origami Spoon Set'}</div>
            <div class="text-xs text-emerald-700 font-semibold mt-0.5">${o.bundle_name || 'Standard Package'}</div>
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

async function dispatchOrderToPathao(orderId) {
  if (!confirm('Are you sure you want to dispatch this order to Pathao Courier?')) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/dispatch-pathao`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Pathao Consignment Created! ID: ${data.consignment_id}`);
      fetchOrders();
    } else {
      alert(`Pathao Error: ${data.error}`);
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
    const res = await fetch(`/api/admin/products/${productId}`, { headers: getAuthHeaders() });
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
  if (!d.howItWorks) d.howItWorks = { steps: [] };
  if (!d.comparison) d.comparison = {};
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

  // 5. How It Works Steps & Images
  if (document.getElementById('edit-howitworks-title')) {
    document.getElementById('edit-howitworks-title').value = d.howItWorks?.title || '';
  }
  const stepsContainer = document.getElementById('howitworks-steps-editor');
  if (stepsContainer) {
    stepsContainer.innerHTML = (d.howItWorks?.steps || []).map((step, i) => `
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
        <div class="font-bold text-xs text-slate-700">Step #${i + 1} (${step.number || '0' + (i+1)})</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" id="edit-step-title-${i}" value="${step.title}" placeholder="Step Title" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold" />
          <textarea id="edit-step-desc-${i}" rows="2" placeholder="Step Description" class="px-3 py-2 rounded-xl border border-slate-200 text-xs">${step.desc}</textarea>
        </div>
        <div class="flex items-center gap-3">
          <input type="file" accept="image/*" onchange="uploadMediaFile(this, 'edit-step-img-${i}', 'step-preview-${i}')" class="text-xs text-slate-500" />
          <input type="text" id="edit-step-img-${i}" value="${step.image || `/images/step${i+1}.svg`}" placeholder="Image Path" class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-latin" />
          <img id="step-preview-${i}" src="${step.image || `/images/step${i+1}.svg`}" class="w-10 h-10 object-contain rounded border bg-white" />
        </div>
      </div>
    `).join('');
  }

  // 6. What's in 1 Set Box (১ সেটে কী কী পাচ্ছেন)
  if (!d.whatsIncluded) {
    d.whatsIncluded = {
      badge: "Complete 1 Set Box",
      title: "আমাদের ১ সেট প্রোডাক্টে কী কী পাচ্ছেন?",
      subtitle: "প্রতি ১ সেটে থাকবে মোট ২টি স্মার্ট ফোল্ডিং চামচ — যাতে সহজেই পেয়ে যাবেন মোট ৮টি নিখুঁত পরিমাপ",
      largeSpoonTitle: "১. বড় মেজারিং চামচ",
      largeSpoonBadge: "৪টি মাপ (Tablespoon)",
      largeSpoonUsage: "তেল, সস, বেকিং ব্যাটার, ময়দা ও চিনির সঠিক মাপের জন্য।",
      smallSpoonTitle: "২. ছোট মেজারিং চামচ",
      smallSpoonBadge: "৪টি মাপ (Teaspoon)",
      smallSpoonUsage: "লবণ, গুঁড়া মসলা, বেকিং পাউডার ও শিশুদের ওষুধের সঠিক মাপ।",
      bannerTitle: "মোট ৮টি ভিন্ন পরিমাপ মাত্র ২টি ফ্ল্যাট চামচে!",
      bannerDesc: "কোনো বাড়তি বাটি বা ভারী স্কেলের ঝামেলা ছাড়াই রান্নাঘরের যেকোনো ড্রয়ারে ফ্ল্যাট রেখে দিন।"
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

  // 7. Comparison Section (Infographic Image)
  if (!d.comparison) {
    d.comparison = {
      title: "কেন এটি সাধারণ চামচের চেয়ে বহুগুণে সেরা?",
      subtitle: "সাধারণ প্লাস্টিক চামচ ও ডিজিটাল স্কেলের সাথে সরাসরি তুলনা",
      imageUrl: "/images/comp-infographic.svg"
    };
  }
  document.getElementById('edit-comp-title').value = d.comparison.title || '';
  document.getElementById('edit-comp-subtitle').value = d.comparison.subtitle || '';
  const compImg = d.comparison.imageUrl || '/images/comp-infographic.svg';
  if (document.getElementById('edit-comp-image-url')) {
    document.getElementById('edit-comp-image-url').value = compImg;
  }
  if (document.getElementById('comp-preview-img')) {
    document.getElementById('comp-preview-img').src = compImg;
  }

  // 7. Unified Package Offers & Checkout Section
  if (!d.checkout) d.checkout = {};
  if (document.getElementById('edit-checkout-title')) {
    document.getElementById('edit-checkout-title').value = d.checkout.title || 'আপনার পছন্দের প্যাকেজটি বেছে নিন';
  }
  if (document.getElementById('edit-checkout-subtitle')) {
    document.getElementById('edit-checkout-subtitle').value = d.checkout.subtitle || '২ বা ৩ সেটের অর্ডারে থাকছে সারাদেশে 1০০% ফ্রি হোম ডেলিভারি';
  }

  const bundlesContainer = document.getElementById('bundles-editor-container');
  bundlesContainer.innerHTML = (d.bundles || []).map((b, i) => `
    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-800 text-xs">Bundle Package #${i + 1} (${b.id})</span>
        <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <input type="checkbox" id="edit-bundle-free-${i}" ${b.freeDelivery ? 'checked' : ''} />
          <span>🚚 Free Delivery</span>
        </label>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="text" id="edit-bundle-name-${i}" value="${b.name}" placeholder="Package Name" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold" />
        <input type="number" id="edit-bundle-price-${i}" value="${b.price}" placeholder="Price (৳)" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-latin" />
        <input type="text" id="edit-bundle-savings-${i}" value="${b.savings || ''}" placeholder="Savings Badge" class="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
      </div>
      <input type="text" id="edit-bundle-desc-${i}" value="${b.desc}" placeholder="Package Description" class="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs" />
    </div>
  `).join('');

  // 8. Delivery Charges
  document.getElementById('edit-delivery-dhaka').value = d.checkout?.deliveryDhaka || 70;
  document.getElementById('edit-delivery-outside').value = d.checkout?.deliveryOutside || 130;

  // 9. Customer Reviews
  const reviewsContainer = document.getElementById('reviews-editor-container');
  reviewsContainer.innerHTML = (d.reviews || []).map((rev, i) => `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="text" id="edit-rev-name-${i}" value="${rev.name}" placeholder="Customer Name" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold" />
        <input type="text" id="edit-rev-loc-${i}" value="${rev.location}" placeholder="Location / City" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
      </div>
      <textarea id="edit-rev-comment-${i}" rows="2" placeholder="Review Quote" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs">${rev.comment}</textarea>
    </div>
  `).join('');

  // 10. FAQs
  const faqContainer = document.getElementById('faq-editor-container');
  faqContainer.innerHTML = (d.faq || []).map((f, i) => `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
      <input type="text" id="edit-faq-q-${i}" value="${f.q}" placeholder="Question" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold" />
      <textarea id="edit-faq-a-${i}" rows="2" placeholder="Answer" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs">${f.a}</textarea>
    </div>
  `).join('');
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

function renderHeroGalleryEditor() {
  const container = document.getElementById('hero-gallery-editor-container');
  if (!container || !currentEditingPageData?.hero) return;

  const gallery = currentEditingPageData.hero.additionalGallery || [];
  if (gallery.length === 0) {
    container.innerHTML = `<div class="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-semibold">No extra showcase images added. Click "+ Add Showcase Image" above to add more pictures to the gallery!</div>`;
    return;
  }

  container.innerHTML = gallery.map((item, i) => {
    const isShown = item.show !== false;
    const url = typeof item === 'string' ? item : (item.url || '');
    return `
      <div class="bg-slate-50 p-4 rounded-xl border ${isShown ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'} space-y-3 transition">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-800 text-xs">
            📸 Extra Showcase Image #${i + 3}
          </span>
          <div class="flex items-center gap-3">
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
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/step1.svg')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">step1.svg</button>
            <button type="button" onclick="setQuickImage('edit-gallery-url-${i}', 'gallery-preview-img-${i}', '/images/step2.svg')" class="bg-white px-2 py-0.5 rounded border hover:bg-slate-100">step2.svg</button>
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



// Media file upload handler
async function uploadMediaFile(inputEl, targetInputId, previewImgId) {
  if (!inputEl.files || !inputEl.files[0]) return;
  const file = inputEl.files[0];
  const formData = new FormData();
  formData.append('media', file);

  try {
    showToast('Uploading media...');
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: formData
    });

    const data = await res.json();
    if (data.success && data.url) {
      const targetInput = document.getElementById(targetInputId);
      if (targetInput) targetInput.value = data.url;
      if (previewImgId) {
        const previewImg = document.getElementById(previewImgId);
        if (previewImg) previewImg.src = data.url;
      }
      // Auto-save immediately to database
      await saveCurrentPageData();
      showToast('Media uploaded & saved to live page! 🎉');
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (err) {
    alert('Upload error: ' + (err.message || 'Network error'));
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
  if (!d.howItWorks) d.howItWorks = { steps: [] };
  if (!d.comparison) d.comparison = {};
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
    c.problemTitle = document.getElementById(`edit-prob-title-${i}`)?.value || c.problemTitle;
    c.solutionTitle = document.getElementById(`edit-sol-title-${i}`)?.value || c.solutionTitle;
    c.problemDesc = document.getElementById(`edit-prob-desc-${i}`)?.value || c.problemDesc;
    c.solutionDesc = document.getElementById(`edit-sol-desc-${i}`)?.value || c.solutionDesc;
  });

  // 5. How It Works
  if (document.getElementById('edit-howitworks-title')) {
    d.howItWorks.title = document.getElementById('edit-howitworks-title').value.trim();
  }
  (d.howItWorks.steps || []).forEach((s, i) => {
    s.title = document.getElementById(`edit-step-title-${i}`)?.value || s.title;
    s.desc = document.getElementById(`edit-step-desc-${i}`)?.value || s.desc;
    s.image = document.getElementById(`edit-step-img-${i}`)?.value || s.image;
  });

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

  // 7. Comparison Section (Image Showcase)
  if (!d.comparison) d.comparison = {};
  if (document.getElementById('edit-comp-title')) {
    d.comparison.title = document.getElementById('edit-comp-title').value.trim();
  }
  if (document.getElementById('edit-comp-subtitle')) {
    d.comparison.subtitle = document.getElementById('edit-comp-subtitle').value.trim();
  }
  if (document.getElementById('edit-comp-image-url')) {
    d.comparison.imageUrl = document.getElementById('edit-comp-image-url').value.trim();
  }

  // 7. Unified Package Offers & Checkout Section
  if (!d.checkout) d.checkout = {};
  if (document.getElementById('edit-checkout-title')) {
    d.checkout.title = document.getElementById('edit-checkout-title').value.trim();
  }
  if (document.getElementById('edit-checkout-subtitle')) {
    d.checkout.subtitle = document.getElementById('edit-checkout-subtitle').value.trim();
  }

  (d.bundles || []).forEach((b, i) => {
    b.name = document.getElementById(`edit-bundle-name-${i}`)?.value || b.name;
    b.price = Number(document.getElementById(`edit-bundle-price-${i}`)?.value || b.price);
    b.savings = document.getElementById(`edit-bundle-savings-${i}`)?.value || b.savings;
    b.desc = document.getElementById(`edit-bundle-desc-${i}`)?.value || b.desc;
    b.freeDelivery = document.getElementById(`edit-bundle-free-${i}`)?.checked || false;
  });

  // 8. Delivery
  if (document.getElementById('edit-delivery-dhaka')) {
    d.checkout.deliveryDhaka = Number(document.getElementById('edit-delivery-dhaka').value);
  }
  if (document.getElementById('edit-delivery-outside')) {
    d.checkout.deliveryOutside = Number(document.getElementById('edit-delivery-outside').value);
  }

  // 9. Reviews
  (d.reviews || []).forEach((r, i) => {
    r.name = document.getElementById(`edit-rev-name-${i}`)?.value || r.name;
    r.location = document.getElementById(`edit-rev-loc-${i}`)?.value || r.location;
    r.comment = document.getElementById(`edit-rev-comment-${i}`)?.value || r.comment;
  });

  // 10. FAQ
  (d.faq || []).forEach((f, i) => {
    f.q = document.getElementById(`edit-faq-q-${i}`)?.value || f.q;
    f.a = document.getElementById(`edit-faq-a-${i}`)?.value || f.a;
  });

  try {
    const res = await fetch(`/api/admin/products/${currentEditingProductId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: d.hero.headline,
        page_data: d
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('All section changes saved successfully! 🎉');
    } else {
      showToast(data.error || 'Failed to save changes', false);
    }
  } catch (err) {
    showToast('Server error!', false);
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
    document.getElementById('set-whatsapp-number').value = s.whatsapp_number || '8801700000000';
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
