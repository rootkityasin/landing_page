// Global state
let currentProduct = null;
let selectedBundle = null;
let selectedColor = 'Red';
let selectedZone = 'dhaka_inside';
let initiateCheckoutFired = false;
const pageViewEventId = 'view_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

// Helper: Convert English digits to Bengali digits
function toBanglaDigits(num) {
  if (num === null || num === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => banglaDigits[d]);
}

// Extract slug from URL path e.g. /p/origami-spoon
function getSlugFromUrl() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'p' && pathParts[1]) {
    return pathParts[1];
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('product') || null;
}

// Fetch Product Configuration (Instant Live Cache Invalidation)
async function loadProduct() {
  try {
    const slug = getSlugFromUrl();
    const endpoint = (slug ? `/api/products/${slug}` : '/api/products/active') + `?_t=${Date.now()}`;
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await res.json();

    if (!data.success || !data.product) {
      document.body.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-slate-200">
            <div class="text-4xl mb-4">🔍</div>
            <h1 class="text-2xl font-bold text-slate-800 mb-2">প্রোডাক্ট খুঁজে পাওয়া যায়নি</h1>
            <p class="text-slate-600 mb-6">দুঃখিত, আপনি যে লিংকটিতে প্রবেশ করেছেন তা সঠিক নয় বা পণ্যটি সরানো হয়েছে।</p>
            <a href="/" class="inline-block bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl">হোমপেজে ফিরে যান</a>
          </div>
        </div>`;
      return;
    }

    currentProduct = data.product;
    renderLandingPage(currentProduct.pageData);
  } catch (err) {
    console.error('Error loading product:', err);
  }
}

// Auto re-validate when tab gains visibility (e.g. after updating Admin panel)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadProduct();
  }
});

// Render dynamic page sections
function renderLandingPage(data) {
  document.title = data.meta.pageTitle || data.hero.headline;

  // Setup Meta Pixel if present
  if (data.meta.pixelId && !window.fbq) {
    initMetaPixel(data.meta.pixelId);
  }

  // 1. Top Urgency Bar
  const topBarEl = document.getElementById('top-urgency-bar');
  if (data.topBar && data.topBar.show) {
    topBarEl.classList.remove('hidden');
    topBarEl.style.backgroundColor = data.theme.topBarBg || '#111827';
    topBarEl.style.color = data.theme.topBarText || '#ffffff';
    topBarEl.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold tracking-wide">
        <span class="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-400 live-dot"></span>
        <span>${data.topBar.text}</span>
      </div>`;
  } else {
    topBarEl.classList.add('hidden');
  }

  // 2. Hero Section
  const heroBadgeEl = document.getElementById('hero-badge-text');
  if (heroBadgeEl) heroBadgeEl.innerText = data.hero.badge || '🔥 ভাইরাল কিচেন গ্যাজেট';
  
  const heroHeadlineEl = document.getElementById('hero-headline');
  if (heroHeadlineEl) {
    let rawHeadline = (data.hero && data.hero.headline) ? data.hero.headline : 'রান্না ও বেকিংয়ে নিখুঁত মাপের 3-in-1 ফোল্ডিং মেজারিং চামচ';
    rawHeadline = rawHeadline.replace(/৪-ইন-১|৪-ইন-1|৩-ইন-১|৩-ইন-1/g, '3-in-1');
    if (rawHeadline.includes('3-in-1')) {
      const parts = rawHeadline.split('3-in-1');
      heroHeadlineEl.innerHTML = `<span class="block">${parts[0].trim()}</span><span class="block text-[#D92143] pt-0.5 font-black"><span class="font-latin">3-in-1</span>${parts[1]}</span>`;
    } else if (rawHeadline.includes('4-in-1')) {
      const parts = rawHeadline.split('4-in-1');
      heroHeadlineEl.innerHTML = `<span class="block">${parts[0].trim()}</span><span class="block text-[#D92143] pt-0.5 font-black"><span class="font-latin">3-in-1</span>${parts[1]}</span>`;
    } else {
      heroHeadlineEl.innerText = rawHeadline;
    }
  }

  const heroSubheadlineEl = document.getElementById('hero-subheadline');
  if (heroSubheadlineEl) heroSubheadlineEl.innerText = data.hero.subheadline;

  const heroRatingEl = document.getElementById('hero-rating-text');
  if (heroRatingEl) heroRatingEl.innerText = data.hero.ratingText || '৪.৯/৫ রেটিং (৩৫০+ ভেরিফাইড রিভিউ)';
  
  const heroRegPriceEl = document.getElementById('hero-regular-price');
  if (heroRegPriceEl) heroRegPriceEl.innerText = `৳${toBanglaDigits(data.hero.regularPrice)}`;

  const heroDiscPriceEl = document.getElementById('hero-discounted-price');
  if (heroDiscPriceEl) heroDiscPriceEl.innerText = `৳${toBanglaDigits(data.hero.discountedPrice)}`;

  const heroDiscBadgeEl = document.getElementById('hero-discount-badge');
  if (heroDiscBadgeEl) heroDiscBadgeEl.innerText = data.hero.discountBadge || '৪০% ছাড়';

  const heroCtaEl = document.getElementById('hero-cta-btn');
  if (heroCtaEl) {
    const rawText = data.hero.ctaText ? data.hero.ctaText.replace('🛒', '').replace('→', '').replace('— ক্যাশ অন ডেলিভারি', '').replace(/\(৳[০-৯0-9,]+\)/g, '').trim() : 'এখনই অর্ডার করুন';
    heroCtaEl.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
      <span>${rawText || 'এখনই অর্ডার করুন'}</span>`;
  }

  // Highlights list
  const highlightsEl = document.getElementById('hero-highlights');
  if (highlightsEl && data.hero.highlights) {
    highlightsEl.innerHTML = data.hero.highlights.map(hl => `
      <li class="flex items-start gap-2.5">
        <span class="w-5 h-5 rounded-full bg-[#FEF5E4] text-[#D92143] border border-[#E0C375] flex items-center justify-center flex-shrink-0 mt-0.5 font-black text-xs shadow-2xs">✓</span>
        <span class="text-[#0F172A] text-sm sm:text-[15px] leading-snug font-medium">${hl}</span>
      </li>
    `).join('');
  }

  // Hero Media
  const heroMediaEl = document.getElementById('hero-media-container');
  if (heroMediaEl) {
    if (data.hero.mediaType === 'video' && data.hero.mediaUrl) {
      heroMediaEl.innerHTML = `
        <video src="${data.hero.mediaUrl}" poster="${data.hero.mediaPoster || ''}" autoplay loop muted playsinline class="w-full h-full object-cover rounded-3xl shadow-xl border border-[#E0C375]/30"></video>`;
    } else {
      let galleryList = [];
      if (data.hero?.showPrimary !== false && data.hero?.mediaUrl) {
        galleryList.push(data.hero.mediaUrl);
      }
      if (data.hero?.showSecondary !== false && data.hero?.secondaryMediaUrl) {
        galleryList.push(data.hero.secondaryMediaUrl);
      }
      if (Array.isArray(data.hero?.additionalGallery)) {
        data.hero.additionalGallery.forEach(item => {
          if (typeof item === 'string' && item.trim()) {
            galleryList.push(item.trim());
          } else if (item && typeof item === 'object' && item.url && item.show !== false) {
            galleryList.push(item.url.trim());
          }
        });
      }

      if (galleryList.length === 0) {
        const fallbacks = [
          data.hero?.mediaUrl,
          data.hero?.secondaryMediaUrl,
          '/images/post1.webp',
          '/images/post2.webp'
        ].filter(Boolean);
        galleryList = fallbacks;
      }

      galleryList = [...new Set(galleryList)];
      const mainMedia = galleryList[0] || '/images/post1.webp';
      const gridColsClass = galleryList.length <= 3
        ? 'grid-cols-3'
        : (galleryList.length === 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6');

      const thumbnailsHtml = galleryList.map((imgSrc, idx) => `
        <button type="button" onclick="switchHeroImg('${imgSrc}', this)" class="hero-thumb-btn rounded-2xl overflow-hidden border-2 ${idx === 0 ? 'border-[#D92143]' : 'border-slate-200'} bg-white shadow-xs p-0.5 transition hover:border-[#F69D39] hover:scale-102">
          <img src="${imgSrc}" width="160" height="160" style="aspect-ratio: 1/1;" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/images/post1.webp';" class="w-full h-14 object-cover rounded-xl" alt="View ${idx + 1}" />
        </button>
      `).join('');

      heroMediaEl.innerHTML = `
        <div class="space-y-3">
          <div class="relative w-full rounded-3xl overflow-hidden shadow-xl border border-[#E0C375]/40 bg-white">
            <img id="main-hero-display-img" src="${mainMedia}" alt="${data.hero.headline}" width="1200" height="1200" style="aspect-ratio: 1/1;" fetchpriority="high" decoding="async" class="w-full h-auto max-h-[460px] object-cover sm:object-contain mx-auto transition duration-500 hover:scale-102" />
            <div class="absolute bottom-3 left-3 bg-[#1C1917]/90 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-lg font-latin border border-[#E0C375]/30">
              <span class="w-2 h-2 rounded-full bg-[#F69D39] live-dot"></span>
              <span>১০০% Genuine Polygons® Product</span>
            </div>
          </div>

          <!-- Thumbnails switcher -->
          <div class="grid ${gridColsClass} gap-2">
            ${thumbnailsHtml}
          </div>
        </div>`;
    }
  }

  // 3. How It Works 3 Steps
  const howTitleEl = document.getElementById('how-it-works-title');
  if (howTitleEl) howTitleEl.innerText = data.howItWorks.title;
  
  const howSubEl = document.getElementById('how-it-works-subtitle');
  if (howSubEl) howSubEl.innerText = data.howItWorks.subtitle;

  const stepsContainer = document.getElementById('steps-container');
  if (stepsContainer && data.howItWorks.steps) {
    const stepColorThemes = [
      {
        border: 'border-[#D92143]/35 hover:border-[#D92143]',
        badgeBg: 'bg-[#FEF5E4]',
        badgeText: 'text-[#D92143]',
        badgeBorder: 'border-[#D92143]/60',
        imgBg: 'bg-[#FEF5E4]/40',
        imgBorder: 'border-[#D92143]/20'
      },
      {
        border: 'border-[#E0C375] hover:border-[#B45309]',
        badgeBg: 'bg-[#FEF5E4]',
        badgeText: 'text-[#9A3412]',
        badgeBorder: 'border-[#E0C375]',
        imgBg: 'bg-[#FEF5E4]/60',
        imgBorder: 'border-[#E0C375]/40'
      },
      {
        border: 'border-[#E0C375]/70 hover:border-[#B45309]',
        badgeBg: 'bg-[#FEF5E4]',
        badgeText: 'text-[#B45309]',
        badgeBorder: 'border-[#E0C375]',
        imgBg: 'bg-[#FEF5E4]/50',
        imgBorder: 'border-[#E0C375]/40'
      }
    ];

    stepsContainer.innerHTML = data.howItWorks.steps.map((step, idx) => {
      const theme = stepColorThemes[idx % stepColorThemes.length];
      const stepNumber = toBanglaDigits(String(idx + 1).padStart(2, '0'));
      return `
      <div class="relative bg-white rounded-3xl border-2 ${theme.border} flex flex-col justify-between hover:shadow-lg transition duration-300 group">
        <!-- Numbering Badge Positioned Above Div -->
        <div class="absolute -top-5 left-1/2 -translate-x-1/2 w-11 h-11 rounded-2xl ${theme.badgeBg} border-2 ${theme.badgeBorder} ${theme.badgeText} font-black text-base flex items-center justify-center shadow-md z-10 group-hover:scale-110 transition">
          ${stepNumber}
        </div>
        
        <!-- Full-Bleed Photo Directly Following Outer Card -->
        <img src="${step.image || `/images/step${idx+1}.svg`}" width="600" height="600" style="aspect-ratio: 4/3;" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/images/step${idx+1}.svg';" alt="${step.title}" class="w-full h-56 sm:h-64 object-cover rounded-t-[22px] transition duration-500 group-hover:scale-[1.01]" />

        <!-- Step Title & Description Below Image -->
        <div class="p-4 sm:p-5 text-center space-y-1.5">
          <h3 class="font-extrabold text-[#0F172A] text-base sm:text-lg leading-snug">${step.title}</h3>
          <p class="text-[#334155] text-xs sm:text-sm leading-relaxed">${step.desc}</p>
        </div>
      </div>`;
    }).join('');
  }

  // 3. What's in 1 Set Box (1 সেটে কী কী পাচ্ছেন)
  if (data.whatsIncluded) {
    const incTitleEl = document.getElementById('included-title');
    if (incTitleEl && data.whatsIncluded.title) incTitleEl.innerText = data.whatsIncluded.title;
    const incSubEl = document.getElementById('included-subtitle');
    if (incSubEl && data.whatsIncluded.subtitle) incSubEl.innerText = data.whatsIncluded.subtitle;
  }

  // 4. Comparison Section (High-Converting Infographic / Image)
  const compTitleEl = document.getElementById('comparison-title');
  if (compTitleEl) {
    if (data.comparison?.title) {
      compTitleEl.innerText = data.comparison.title;
    } else {
      compTitleEl.innerText = 'কেন এটি আপনার সাধারণ চামচের চেয়ে বহুগুণে সেরা?';
    }
  }

  const compSubEl = document.getElementById('comparison-subtitle');
  if (compSubEl) {
    if (data.comparison?.subtitle) {
      compSubEl.innerText = data.comparison.subtitle;
    } else {
      compSubEl.innerText = 'সাধারণ প্লাস্টিক চামচ ও ডিজিটাল স্কেলের সাথে সরাসরি তুলনা';
    }
  }

  const compImgEl = document.getElementById('comparison-img');
  if (compImgEl) {
    const compImageSrc = data.comparison?.imageUrl || '/uploads/media-1787690411261-932816281.webp';
    compImgEl.src = compImageSrc;
    compImgEl.onerror = function() {
      this.onerror = null;
      this.src = '/uploads/media-1787690411261-932816281.webp';
    };
    compImgEl.alt = data.comparison?.title || 'Comparison Infographic';
  }

  // 5. Unified Package Offers & Checkout Section
  const checkoutTitleEl = document.getElementById('checkout-title');
  if (checkoutTitleEl) checkoutTitleEl.innerText = data.checkout?.title || 'আপনার পছন্দের প্যাকেজটি বেছে নিন';

  const checkoutSubEl = document.getElementById('checkout-subtitle');
  if (checkoutSubEl) checkoutSubEl.innerText = data.checkout?.subtitle || '২ বা ৩ সেটের অর্ডারে থাকছে সারাদেশে ১০০% ফ্রি হোম ডেলিভারি';

  // Dynamic Delivery Zone Rate Badges
  const insidePriceEl = document.getElementById('zone-inside-price');
  if (insidePriceEl && data.checkout) {
    const rateDhaka = data.checkout.deliveryDhaka !== undefined && data.checkout.deliveryDhaka !== ''
      ? Number(data.checkout.deliveryDhaka)
      : 60;
    insidePriceEl.innerText = rateDhaka === 0 ? 'ফ্রি (৳০)' : `৳${toBanglaDigits(rateDhaka)}`;
  }

  const outsidePriceEl = document.getElementById('zone-outside-price');
  if (outsidePriceEl && data.checkout) {
    const rateOutside = data.checkout.deliveryOutside !== undefined && data.checkout.deliveryOutside !== ''
      ? Number(data.checkout.deliveryOutside)
      : 130;
    outsidePriceEl.innerText = rateOutside === 0 ? 'ফ্রি (৳০)' : `৳${toBanglaDigits(rateOutside)}`;
  }

  renderBundles(data.bundles);

  // 6. Social Proof & Reviews
  const reviewsContainer = document.getElementById('reviews-container');
  if (reviewsContainer && data.reviews) {
    reviewsContainer.innerHTML = data.reviews.map((rev, i) => `
      <div class="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#E0C375]/35 flex flex-col justify-between hover:border-[#D92143]/50 hover:shadow-md transition space-y-4">
        <div>
          <div class="flex items-center justify-between mb-3.5">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-full bg-[#FEF5E4] border-2 border-[#E0C375] flex items-center justify-center font-extrabold text-[#D92143] text-base shadow-xs">
                ${rev.name.substring(0, 1)}
              </div>
              <div>
                <h3 class="font-extrabold text-[#0F172A] text-base sm:text-lg leading-tight">${rev.name}</h3>
                <p class="text-xs text-[#475569] font-bold">${rev.location}</p>
              </div>
            </div>
            <div class="flex items-center text-[#B45309] text-base tracking-tight">
              ${'★'.repeat(rev.rating || 5)}
            </div>
          </div>

          <p class="text-[#334155] text-sm sm:text-base leading-relaxed italic">"${rev.comment}"</p>
        </div>
      </div>
    `).join('');
  }

  // 7. Trust Badges
  const trustBadgesContainer = document.getElementById('trust-badges-container');
  if (trustBadgesContainer && data.trustBadges) {
    const badgeIcons = ['/images/trust-cod.svg', '/images/trust-shipping.svg', '/images/trust-warranty.svg'];
    trustBadgesContainer.innerHTML = data.trustBadges.map((tb, i) => `
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-[#E0C375]/30 flex items-center gap-4 hover:border-[#D92143]/40 transition">
        <img src="${badgeIcons[i] || badgeIcons[0]}" alt="${tb.title}" class="w-12 h-12 flex-shrink-0" />
        <div>
          <h3 class="font-bold text-[#0F172A] text-sm sm:text-base">${tb.title}</h3>
          <p class="text-xs sm:text-sm text-[#334155]">${tb.desc}</p>
        </div>
      </div>
    `).join('');
  }

  // 8. FAQs
  const faqContainer = document.getElementById('faq-container');
  if (faqContainer && data.faq) {
    faqContainer.innerHTML = data.faq.map((item, idx) => `
      <div class="faq-item bg-white rounded-2xl border border-[#E0C375]/40 overflow-hidden transition">
        <button onclick="toggleFaq(this)" class="w-full text-left p-4 sm:p-5 font-bold text-[#0F172A] text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-[#FEF5E4]/40 transition">
          <span>${item.q}</span>
          <span class="faq-icon text-[#F69D39] transition-transform duration-300 font-extrabold text-sm">▼</span>
        </button>
        <div class="faq-answer px-4 sm:px-5 text-[#334155] text-sm leading-relaxed border-t border-[#E0C375]/20 bg-[#FEF5E4]/20">
          ${item.a}
        </div>
      </div>
    `).join('');
  }

  // Update sticky mobile bar price
  updateCheckoutSummary();
}

// Render Offer Bundles & attach event listeners
function renderBundles(bundles) {
  const bundlesContainer = document.getElementById('bundles-container');
  if (!bundles || bundles.length === 0 || !bundlesContainer) return;

  // Set default selected bundle (prefer isPopular or index 1)
  const popularBundle = bundles.find(b => b.isPopular) || bundles[1] || bundles[0];
  selectedBundle = popularBundle;

  bundlesContainer.innerHTML = bundles.map(b => {
    const isSelected = b.id === selectedBundle.id;
    return `
      <div onclick="selectBundle('${b.id}')" id="bundle-card-${b.id}" class="bundle-card ${isSelected ? 'selected' : ''} relative rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
        ${b.badge ? `
          <div class="absolute -top-3.5 right-5 ${b.isPopular ? 'bg-[#D92143] text-white' : 'bg-[#0F172A] text-[#E0C375] border border-[#E0C375]/30'} text-[11px] font-extrabold px-3.5 py-1 rounded-full shadow-sm font-latin tracking-wide">
            ${b.badge}
          </div>
        ` : ''}

        <div class="flex items-start justify-between gap-2.5 mb-3">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="bundle-radio-circle flex-shrink-0">
              <div class="bundle-radio-dot"></div>
            </div>
            <div class="min-w-0">
              <h3 class="font-extrabold text-[#0F172A] text-[13px] xs:text-[14px] sm:text-base md:text-sm lg:text-base leading-tight whitespace-nowrap">${b.name}</h3>
              <p class="text-xs text-[#334155] mt-0.5">${b.desc}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 pl-1">
            <div class="text-xl sm:text-2xl font-extrabold text-[#D92143]">৳${toBanglaDigits(b.price)}</div>
            ${b.regularPrice ? `<div class="text-xs text-[#475569] font-bold line-through">৳${toBanglaDigits(b.regularPrice)}</div>` : ''}
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-[#E0C375]/40 mt-2 text-xs">
          <span class="font-bold text-[#D92143]">${b.savings || 'বিশেষ ছাড়'}</span>
          <span class="font-bold ${b.freeDelivery ? 'text-[#D92143] bg-[#FEF5E4] border border-[#E0C375] px-2.5 py-0.5 rounded-full' : 'text-[#334155]'}">
            ${b.freeDelivery ? '🚚 ফ্রি ডেলিভারি' : '+ ডেলিভারি চার্জ'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  selectBundle(popularBundle.id);
}

// Switch Selected Bundle
function selectBundle(bundleId) {
  if (!currentProduct) return;
  const bundle = currentProduct.pageData.bundles.find(b => b.id === bundleId);
  if (!bundle) return;

  selectedBundle = bundle;

  // Toggle selected class on bundle cards
  document.querySelectorAll('.bundle-card').forEach(card => {
    card.classList.remove('selected');
  });

  const activeCard = document.getElementById(`bundle-card-${bundleId}`);
  if (activeCard) {
    activeCard.classList.add('selected');
  }

  // Update Color Labels & Mixed Combo option visibility based on bundle size
  const redLabelEl = document.getElementById('color-label-red');
  const blackLabelEl = document.getElementById('color-label-black');
  const mixedOptEl = document.getElementById('color-opt-Mixed');
  const mixedDescEl = document.getElementById('mixed-color-desc');

  if (bundleId === 'bundle_2') {
    if (redLabelEl) redLabelEl.innerText = '২টিই মেরুন রেড';
    if (blackLabelEl) blackLabelEl.innerText = '২টিই ক্লাসিক ব্ল্যাক';
    if (mixedOptEl) {
      mixedOptEl.classList.remove('hidden');
      mixedOptEl.classList.add('flex');
    }
    if (mixedDescEl) mixedDescEl.innerText = '১টি মেরুন রেড + ১টি ক্লাসিক ব্ল্যাক';
    selectColor('Mixed');
  } else if (bundleId === 'bundle_3') {
    if (redLabelEl) redLabelEl.innerText = '৩টিই মেরুন রেড';
    if (blackLabelEl) blackLabelEl.innerText = '৩টিই ক্লাসিক ব্ল্যাক';
    if (mixedOptEl) {
      mixedOptEl.classList.remove('hidden');
      mixedOptEl.classList.add('flex');
    }
    if (mixedDescEl) mixedDescEl.innerText = '২টি মেরুন রেড + ১টি ক্লাসিক ব্ল্যাক';
    selectColor('Mixed');
  } else {
    if (redLabelEl) redLabelEl.innerText = 'মেরুন রেড';
    if (blackLabelEl) blackLabelEl.innerText = 'ক্লাসিক ব্ল্যাক';
    if (mixedOptEl) {
      mixedOptEl.classList.add('hidden');
      mixedOptEl.classList.remove('flex');
    }
    selectColor('Red');
  }

  updateCheckoutSummary();
  fireInitiateCheckout();
}

// Select Color Variant (Red / Black / Mixed)
function selectColor(color) {
  selectedColor = color;

  const options = ['Red', 'Black', 'Mixed'];
  options.forEach(opt => {
    const el = document.getElementById(`color-opt-${opt}`);
    if (!el) return;
    const dot = el.querySelector('.color-radio-dot');
    const check = dot ? dot.querySelector('span') : null;

    if (opt === color) {
      el.classList.add('selected', 'border-[#D92143]', 'bg-[#FEF5E4]');
      el.classList.remove('border-[#E0C375]/50', 'border-[#0F172A]', 'bg-white');
      if (dot) {
        dot.className = 'color-radio-dot w-4 h-4 rounded-full border-2 border-[#D92143] bg-[#D92143] flex items-center justify-center flex-shrink-0';
      }
      if (check) check.classList.remove('hidden');
    } else {
      el.classList.remove('selected', 'border-[#D92143]', 'bg-[#FEF5E4]');
      el.classList.add('border-[#E0C375]/50', 'bg-white');
      if (dot) {
        dot.className = 'color-radio-dot w-4 h-4 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center flex-shrink-0';
      }
      if (check) check.classList.add('hidden');
    }
  });

  updateCheckoutSummary();
}

// Select Delivery Zone (dhaka_inside / dhaka_outside)
function selectZone(zone) {
  selectedZone = zone;
  
  document.querySelectorAll('.zone-card').forEach(el => {
    el.classList.remove('selected');
  });

  const activeZoneEl = document.getElementById(`zone-${zone}`);
  if (activeZoneEl) {
    activeZoneEl.classList.add('selected');
  }

  updateCheckoutSummary();
}

// Recalculate Live Invoice Totals
function updateCheckoutSummary() {
  if (!currentProduct || !selectedBundle) return;
  const pageData = currentProduct.pageData;

  const itemPrice = Number(selectedBundle.price);
  const deliveryDhaka = pageData.checkout && pageData.checkout.deliveryDhaka !== undefined && pageData.checkout.deliveryDhaka !== ''
    ? Number(pageData.checkout.deliveryDhaka)
    : 60;
  const deliveryOutside = pageData.checkout && pageData.checkout.deliveryOutside !== undefined && pageData.checkout.deliveryOutside !== ''
    ? Number(pageData.checkout.deliveryOutside)
    : 130;

  const deliveryRate = selectedZone === 'dhaka_outside' ? deliveryOutside : deliveryDhaka;

  const deliveryCharge = selectedBundle.freeDelivery ? 0 : deliveryRate;
  const grandTotal = itemPrice + deliveryCharge;

  const bNameEl = document.getElementById('summary-bundle-name');
  if (bNameEl) bNameEl.innerText = selectedBundle.name;

  const colorNameEl = document.getElementById('summary-color-name');
  if (colorNameEl) {
    if (selectedColor === 'Red') {
      colorNameEl.innerText = 'মেরুন রেড (Maroon Red)';
      colorNameEl.className = 'font-extrabold text-[#D92143]';
    } else if (selectedColor === 'Black') {
      colorNameEl.innerText = 'ক্লাসিক ব্ল্যাক (Classic Black)';
      colorNameEl.className = 'font-extrabold text-[#0F172A]';
    } else {
      colorNameEl.innerText = selectedBundle?.id === 'bundle_3' ? 'মিক্সড (২টি লাল + ১টি কালো)' : 'মিক্সড (১টি লাল + ১টি কালো)';
      colorNameEl.className = 'font-extrabold text-[#B45309]';
    }
  }

  const itemPriceEl = document.getElementById('summary-item-price');
  if (itemPriceEl) itemPriceEl.innerText = `৳${toBanglaDigits(itemPrice)}`;

  const deliveryEl = document.getElementById('summary-delivery-charge');
  if (deliveryEl) {
    if (selectedBundle.freeDelivery) {
      deliveryEl.innerHTML = `<span class="text-[#D92143] font-bold">ফ্রি (৳০)</span>`;
    } else {
      deliveryEl.innerText = `৳${toBanglaDigits(deliveryCharge)}`;
    }
  }

  const grandTotalEl = document.getElementById('summary-total-amount') || document.getElementById('summary-grand-total');
  if (grandTotalEl) grandTotalEl.innerText = `৳${toBanglaDigits(grandTotal)}`;

  // Update Submit Button Text (Only Cash on Delivery and Price)
  const submitBtnText = document.getElementById('submit-btn-text');
  if (submitBtnText) {
    submitBtnText.innerText = `ক্যাশ অন ডেলিভারি (৳${toBanglaDigits(grandTotal)})`;
  }
  const submitOrderBtn = document.getElementById('submit-order-btn');
  if (submitOrderBtn && !submitBtnText) {
    submitOrderBtn.innerHTML = `
      <span>ক্যাশ অন ডেলিভারি (৳${toBanglaDigits(grandTotal)})</span>
    `;
  }

  // Update Mobile Sticky Bar Price
  const mobileBarPrice = document.getElementById('mobile-bar-price');
  if (mobileBarPrice) {
    mobileBarPrice.innerText = `৳${toBanglaDigits(grandTotal)}`;
  }
}

// Scroll to checkout form smoothly
function scrollToCheckout() {
  const formEl = document.getElementById('checkout-section');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth' });
    fireInitiateCheckout();
  }
}

// Toggle FAQ item
function toggleFaq(buttonEl) {
  const item = buttonEl.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
  if (!isOpen) {
    item.classList.add('open');
  }
}

// Meta Pixel tracking helper
function initMetaPixel(pixelId) {
  if (window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  fbq('init', pixelId);
  fbq('track', 'PageView', {}, { eventID: pageViewEventId });
  fbq('track', 'ViewContent', {
    content_name: currentProduct?.title || 'Origami Spoon',
    content_type: 'product',
    value: selectedBundle?.price || 550,
    currency: 'BDT'
  }, { eventID: pageViewEventId });
}

// Fire InitiateCheckout once
function fireInitiateCheckout() {
  if (initiateCheckoutFired) return;
  initiateCheckoutFired = true;

  const eventId = 'init_' + Date.now();
  if (window.fbq) {
    fbq('track', 'InitiateCheckout', {
      value: selectedBundle?.price || 550,
      currency: 'BDT'
    }, { eventID: eventId });
  }

  // Relay to server-side Meta CAPI
  fetch('/api/tracking/capi-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 'InitiateCheckout',
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: {
        currency: 'BDT',
        value: selectedBundle?.price || 550
      }
    })
  }).catch(() => {});
}

// Handle Order Form Submission
async function handleOrderSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const addressInput = document.getElementById('cust-address');
  const submitBtn = document.getElementById('checkout-submit-btn') || document.getElementById('submit-order-btn');
  const errorAlert = document.getElementById('order-error-alert');

  if (errorAlert) errorAlert.classList.add('hidden');

  const customerName = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const address = addressInput.value.trim();

  if (!customerName) {
    showFormError('অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।');
    nameInput.focus();
    return;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(cleanPhone)) {
    showFormError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
    phoneInput.focus();
    return;
  }

  if (!address || address.length < 5) {
    showFormError('অনুগ্রহ করে আপনার বিস্তারিত ঠিকানা দিন (বাসা নং, রোড নং, এলাকা, থানা, জেলা)।');
    addressInput.focus();
    return;
  }

  // Disable button and show loader
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
  }
  const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.innerHTML = `
      <span class="inline-block animate-spin mr-2">⏳</span>
      <span>অর্ডার প্রসেস হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
    `;
  }

  const orderEventId = 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  try {
    const payload = {
      product_slug: currentProduct?.slug || 'origami-spoon',
      customer_name: customerName,
      phone: cleanPhone,
      address: address,
      delivery_zone: selectedZone,
      bundle_id: selectedBundle?.id || 'bundle_2',
      color_variant: selectedColor,
      event_id: orderEventId
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success && data.order) {
      // Fire client-side purchase pixel
      if (window.fbq) {
        fbq('track', 'Purchase', {
          content_name: data.order.product_name,
          value: data.order.total_amount,
          currency: 'BDT',
          order_id: data.order.order_number
        }, { eventID: orderEventId });
      }

      // Redirect to Thank You page
      window.location.href = `/thankyou?orderId=${data.order.order_number}`;
    } else {
      showFormError(data.error || 'অর্ডার সম্পন্ন হতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      submitBtn.innerHTML = originalBtnContent;
    }
  } catch (err) {
    showFormError('সার্ভারে যোগাযোগ করতে সমস্যা হচ্ছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করুন।');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    submitBtn.innerHTML = originalBtnContent;
  }
}

function showFormError(msg) {
  const errorAlert = document.getElementById('order-error-alert');
  errorAlert.innerText = msg;
  errorAlert.classList.remove('hidden');
}

// Interactive Hero Image Switcher
function switchHeroImg(imgUrl, btnEl) {
  const mainImg = document.getElementById('main-hero-display-img');
  if (mainImg) {
    mainImg.src = imgUrl;
  }
  document.querySelectorAll('.hero-thumb-btn').forEach(btn => {
    btn.classList.remove('border-emerald-600');
    btn.classList.add('border-slate-200');
  });
  if (btnEl) {
    btnEl.classList.remove('border-slate-200');
    btnEl.classList.add('border-emerald-600');
  }
}

// Real-time Phone Number Validation & Auto-Cleaner
function validatePhoneLive(inputEl) {
  let val = inputEl.value.replace(/[^0-9]/g, '');
  if (val.startsWith('880')) {
    val = '0' + val.substring(3);
  }
  inputEl.value = val;

  const validIcon = document.getElementById('phone-valid-icon');
  const helperText = document.getElementById('phone-helper-text');
  const bdRegex = /^01[3-9]\d{8}$/;

  if (bdRegex.test(val)) {
    if (validIcon) validIcon.classList.remove('hidden');
    inputEl.classList.add('border-emerald-500', 'bg-emerald-50/30');
    inputEl.classList.remove('border-rose-400');
    if (helperText) {
      helperText.innerText = '✓ সঠিক মোবাইল নম্বর দেওয়া হয়েছে।';
      helperText.className = 'text-xs text-emerald-600 font-bold mt-1';
    }
  } else {
    if (validIcon) validIcon.classList.add('hidden');
    inputEl.classList.remove('border-emerald-500', 'bg-emerald-50/30');
    if (val.length > 0 && val.length < 11) {
      if (helperText) {
        helperText.innerText = `১১ ডিজিট প্রয়োজন (বর্তমানে ${toBanglaDigits(val.length)} ডিজিট)`;
        helperText.className = 'text-xs text-amber-600 font-semibold mt-1';
      }
    } else if (val.length > 11) {
      if (helperText) {
        helperText.innerText = 'মোবাইল নম্বর সর্বোচ্চ ১১ ডিজিট হতে হবে।';
        helperText.className = 'text-xs text-rose-500 font-semibold mt-1';
      }
    } else {
      if (helperText) {
        helperText.innerText = 'ডেলিভারি কনফার্মেশনের জন্য আপনার সচল নম্বরটি দিন।';
        helperText.className = 'text-xs text-slate-500 mt-1';
      }
    }
  }
}

// Live Social Proof Notification Popup (FOMO & Trust Trigger)
const recentCustomers = [
  { name: 'তানভীর আহমেদ', area: 'উত্তরা, ঢাকা', pkg: '২ সেটের ফ্যামিলি প্যাক', mins: '২' },
  { name: 'মেহজাবিন চৌধুরী', area: 'জিইসি, চট্টগ্রাম', pkg: '১ সেট ট্রায়াল প্যাক', mins: '৪' },
  { name: 'রোকসানা পারভীন', area: 'মিরপুর ১০, ঢাকা', pkg: '২ সেটের ফ্যামিলি প্যাক', mins: '১' },
  { name: 'ফারহানা সুলতানা', area: 'ধানমন্ডি, ঢাকা', pkg: '৩ সেটের সুপার সেভার প্যাক', mins: '৫' },
  { name: 'আরিফুল ইসলাম', area: 'উপশহর, সিলেট', pkg: '২ সেটের ফ্যামিলি প্যাক', mins: '৩' },
  { name: 'নুসরাত জাহান', area: 'খালিশপুর, খুলনা', pkg: '১ সেট ট্রায়াল প্যাক', mins: '৬' },
  { name: 'মাহমুদুল হাসান', area: 'বোয়ালিয়া, রাজশাহী', pkg: '২ সেটের ফ্যামিলি প্যাক', mins: '২' }
];

let socialProofIndex = 0;
let socialProofTimer = null;

function showNextSocialProof() {
  const toast = document.getElementById('social-proof-toast');
  if (!toast) return;

  const cust = recentCustomers[socialProofIndex];
  socialProofIndex = (socialProofIndex + 1) % recentCustomers.length;

  document.getElementById('sp-customer-text').innerText = `${cust.name} (${cust.area})`;
  document.getElementById('sp-order-text').innerText = `মাত্র ${toBanglaDigits(cust.mins)} মিনিট আগে ${cust.pkg} অর্ডার করেছেন ✓`;

  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.remove('translate-y-8', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 50);

  // Hide after 5.5 seconds
  setTimeout(() => {
    closeSocialProofToast();
  }, 5500);
}

function closeSocialProofToast() {
  const toast = document.getElementById('social-proof-toast');
  if (toast) {
    toast.classList.add('translate-y-8', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 500);
  }
}

function startSocialProofLoop() {
  setTimeout(() => {
    showNextSocialProof();
    socialProofTimer = setInterval(showNextSocialProof, 18000);
  }, 4000);
}

// Synchronized 4-Hour Countdown Timer
function updateSynchronized4HourTimer() {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = FOUR_HOURS_MS - (now % FOUR_HOURS_MS);

  const totalSecs = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const hStr = hours < 10 ? '০' + toBanglaDigits(hours) : toBanglaDigits(hours);
  const mStr = mins < 10 ? '০' + toBanglaDigits(mins) : toBanglaDigits(mins);
  const sStr = secs < 10 ? '০' + toBanglaDigits(secs) : toBanglaDigits(secs);

  // Update Hero Countdown Widget Digits
  const hEl = document.getElementById('timer-hours');
  const mEl = document.getElementById('timer-minutes');
  const sEl = document.getElementById('timer-seconds');
  if (hEl) hEl.innerText = hStr;
  if (mEl) mEl.innerText = mStr;
  if (sEl) sEl.innerText = sStr;

  // Update Top Bar Urgency Banner
  const urgencyTextEl = document.getElementById('top-urgency-text');
  if (urgencyTextEl) {
    urgencyTextEl.innerHTML = `Polygons® Official Store • ৪ ঘণ্টার স্পেশাল অফার — শেষ হতে আর মাত্র <span class="text-[#F69D39] font-bold">${hStr} ঘণ্টা ${mStr} মি: ${sStr} সে:</span> বাকি!`;
  }
}

function startFlashCountdown() {
  updateSynchronized4HourTimer();
  setInterval(updateSynchronized4HourTimer, 1000);
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  loadProduct();
  startSocialProofLoop();
  startFlashCountdown();

  // Attach form listeners
  const orderForm = document.getElementById('cod-order-form');
  if (orderForm) {
    orderForm.addEventListener('submit', handleOrderSubmit);
  }

  // Detect first input to fire InitiateCheckout
  const inputs = document.querySelectorAll('#cod-order-form input, #cod-order-form textarea');
  inputs.forEach(inp => {
    inp.addEventListener('focus', fireInitiateCheckout, { once: true });
  });
});


