const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect Vercel / AWS Lambda Serverless Environment
const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

let dbPath = path.join(__dirname, 'database.sqlite');

if (isVercel) {
  const tmpDbPath = path.join(os.tmpdir(), 'database.sqlite');
  const bundledDbPath = path.join(__dirname, 'database.sqlite');
  try {
    if (!fs.existsSync(tmpDbPath)) {
      if (fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
        console.log('Copied bundled database.sqlite to /tmp/database.sqlite for full write access on Vercel');
      }
    }
    dbPath = tmpDbPath;
  } catch (err) {
    console.warn('Vercel tmpdb copy notice:', err.message);
    dbPath = tmpDbPath;
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database at', dbPath, err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

// Helper for promise-based queries
const normalizeParams = (params) => {
  if (!params) return [];
  const arr = Array.isArray(params) ? params : [params];
  return arr.map(p => (p === undefined ? null : p));
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, normalizeParams(params), function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, normalizeParams(params), (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, normalizeParams(params), (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const defaultOrigamiPageData = {
  meta: {
    pageTitle: "POLYGONS® Flat 3-in-1 Folding Measuring Spoons | ২ চামচে ৬টি সাইজ",
    metaDesc: "অরিজিনাল Polygons ফ্ল্যাট ৩-ইন-১ ফোল্ডিং মেজারিং চামচ (সেট অফ ২ - ৬টি সাইজ)। DuraBend™ টেকনোলজি, ম্যাগনেটিক ও লিক-প্রুফ ডিজাইন।",
    pixelId: "1997638254273409",
        testEventCode: "",
    supportEmail: "info.polygonsbd@gmail.com"
  },
  theme: {
    primaryColor: "#D92143",
    accentColor: "#F69D39",
    goldColor: "#E0C375",
    creamColor: "#FEF5E4",
    topBarBg: "#1C1917",
    topBarText: "#ffffff"
  },
  topBar: {
    show: true,
    text: "🔥 ভাইরাল কিচেন গ্যাজেট | আজকের স্পেশাল অফার — স্টক আর মাত্র ৭টি বাকি!",
    badge: "সীমিত সময়ের অফার"
  },
  hero: {
    badge: "🔥 আজকের স্পেশাল ডিসকাউন্ট অফার",
    headline: "রান্না ও বেকিংয়ে নিখুঁত মাপের 3-in-1 ফোল্ডিং মেজারিং চামচ",
    subheadline: "১টি চামচেই ৩টি সাইজ — মোট ২টি চামচে ৬টি নিখুঁত পরিমাপ এবং ১ সেকেন্ডে ফ্ল্যাট করে তেল-মধু পরিষ্কারের আধুনিক সল্যুশন।",
    highlights: [
      "⚡ ৩টি সাইজ ১টি চামচে (মোট ৬টি মাপ): ২টি চামচ দিয়েই পেয়ে যাবেন ৬টি ভিন্ন নিখুঁত পরিমাপ।",
      "🧲 ম্যাগনেটিক ও ফ্ল্যাট স্টোরেজ: ড্রয়ারে ০% স্পেস ও ফ্রিজ বা ম্যাগনেটিক স্ট্রিপে রাখার সুবিধা।",
      "🛡️ DuraBend™ টেকনোলজি (১০০,০০০+ ফোল্ড): ফুড-সেফ পলিমার যা কখনো ভাঙবে না বা বাঁকা হবে না।"
    ],
    ratingText: "৪.৯/৫ রেটিং (৩৫০+ ভেরিফাইড রিভিউ)",
    regularPrice: 1200,
    discountedPrice: 666,
    discountBadge: "৪৫% ছাড়",
    ctaText: "এখনই অর্ডার করুন",
    mediaType: "image",
    mediaUrl: "/images/post1.webp",
    secondaryMediaUrl: "/images/post2.webp",
    mediaPoster: ""
  },
  colors: [
    { id: "Red", name: "মেরুন রেড", englishName: "Maroon Red", hex: "#D92143", imageUrl: "/images/variant-red.webp", fullImageUrl: "/images/variant-red-full.webp" },
    { id: "Black", name: "ক্লাসিক ব্ল্যাক", englishName: "Classic Black", hex: "#1C1917", imageUrl: "/images/variant-black.webp", fullImageUrl: "/images/variant-black-full.webp" }
  ],
  problemSolution: {
    title: "কেন পুরনো মেজারিং চামচগুলো আপনার কিচেনের বিরক্তির কারণ?",
    subtitle: "সাধারণ চামচের সমস্যা বনাম আমাদের ৩-ইন-১ পলিগনস স্পুনের আধুনিক সমাধান",
    cards: [
      {
        problemTitle: "❌ ড্রয়ারে জায়গা নষ্ট ও হারিয়ে যাওয়া",
        problemDesc: "সাধারণ প্লাস্টিক চামচগুলো রিংয়ের ভেতর আটকে থাকে, ড্রয়ার খুললে জটলা পাকায় এবং কাজের সময় হারিয়ে যায়।",
        solutionTitle: "👉 একদম স্লিম ও ম্যাগনেটিক ডিজাইন",
        solutionDesc: "ব্যবহার না করলে এটি কাগজের মতো একদম ফ্ল্যাট থাকে—ড্রয়ারে ০% জায়গা নেয় অথবা ম্যাগনেটিক স্ট্রিপে আটকে রাখা যায়।"
      },
      {
        problemTitle: "❌ তেল, মধু ও পিনাট বাটার নষ্ট হওয়া",
        problemDesc: "ঘন বা আঠালো উপাদান সাধারণ চামচের কোণায় আটকে থাকে, আঙুল বা চামচ দিয়ে খুঁচিয়েও পুরোটা নামানো যায় না।",
        solutionTitle: "👉 ফ্ল্যাট ওয়াইপ ও ১০০% লিক-প্রুফ",
        solutionDesc: "ফ্ল্যাট করে এক টানে সমস্ত মধু, ঘি বা তেল সম্পূর্ণ পরিষ্কার করে নামিয়ে দেওয়া যায়। সম্পূর্ণ লিক-প্রুফ।"
      },
      {
        problemTitle: "❌ ধুতে সময় লাগা ও মসলা জমে থাকা",
        problemDesc: "সাধারণ চামচের গভীর কোনা-কাঞ্চিতে মসলা ও হলুদ জমে থাকে, যা স্পঞ্জ দিয়ে সহজে পরিষ্কার হয় না।",
        solutionTitle: "👉 ১ সেকেন্ডে ট্যাপের পানিতে ক্লিন",
        solutionDesc: "সোজা ফ্ল্যাট করে কলের পানির নিচে ধরলেই নিমিষে পরিষ্কার। ডিশওয়াশার টপ-র‌্যাক সেফ ও দাগ-প্রতিরোধী।"
      }
    ]
  },
  videoDemo: {
    badge: "🎥 ভিডিও ডেমোস্ট্রেশন",
    title: "ভিডিওতে দেখুন এটি কীভাবে কাজ করে ও সহজে ব্যবহার করবেন",
    subtitle: "মাত্র কয়েক সেকেন্ডে নিখুঁত পরিমাপ ও ব্যবহারের সহজ পদ্ধতি সরাসরি ভিডিওতে দেখে নিন",
    videoUrl: "/uploads/media-1787674998296-587000979.mp4",
    posterUrl: "/uploads/media-1787681475090-937220178.webp"
  },
  whatsIncluded: {
    badge: "১ সেটের সম্পূর্ণ বক্স (গিফট প্যাকেজিং)",
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
  },
  bundles: [
    {
      id: "bundle_1",
      name: "১ সেট — ৳৬৬৬",
      badge: "১ সেট (বিজ্ঞাপনের অফার)",
      desc: "১টি বড় চামচ + ১টি ছোট চামচ (মোট ৬টি মাপ)",
      price: 666,
      regularPrice: 1200,
      savings: "৫৩৪ টাকা ছাড় (৪৫% ছাড়)",
      freeDelivery: false,
      isPopular: false
    },
    {
      id: "bundle_2",
      name: "২ সেট — ৳১,১৯৯",
      badge: "⭐ সেরা অফার + ফ্রি ডেলিভারি",
      desc: "২টি বড় চামচ + ২টি ছোট চামচ (ফ্যামিলি ও গিফট প্যাক)",
      price: 1199,
      regularPrice: 2400,
      savings: "১২০১ টাকা ছাড় + ফ্রি ডেলিভারি",
      freeDelivery: true,
      isPopular: true
    },
    {
      id: "bundle_3",
      name: "৩ সেট — ৳১,৬৯৯",
      badge: "🔥 মেগা সেভার + ফ্রি ডেলিভারি",
      desc: "৩টি বড় চামচ + ৩টি ছোট চামচ (নিজের ও আত্মীয়দের জন্য)",
      price: 1699,
      regularPrice: 3600,
      savings: "১৯০১ টাকা ছাড় + ফ্রি ডেলিভারি",
      freeDelivery: true,
      isPopular: false
    }
  ],
  checkout: {
    title: "প্যাকেজ অফার বেছে নিয়ে অর্ডার কনফার্ম করুন",
    subtitle: "১ সেটে বিজ্ঞাপনের অফার ৳৬৬৬ • ২ বা ৩ সেটে পাচ্ছেন ১০০% ফ্রি হোম ডেলিভারি",
    formTitle: "অর্ডার কনফার্ম করতে নিচের তথ্যগুলো পূরণ করুন",
    formSubtitle: "🔒 ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে চেক করে টাকা পরিশোধ করবেন",
    deliveryDhaka: 60,
    deliveryOutside: 130,
    submitBtnText: "অর্ডার কনফার্ম করুন",
    guaranteeNotice: "ডেলিভারি ম্যানের সামনে প্রোডাক্ট দেখে রিসিভ করতে পারবেন।"
  },
  reviews: [],
  trustBadges: [
    {
      title: "ক্যাশ অন ডেলিভারি",
      desc: "পণ্য হাতে পেয়ে চেক করে সম্পূর্ণ মূল্য পরিশোধ করুন"
    },
    {
      title: "সারাদেশে দ্রুত ডেলিভারি",
      desc: "ঢাকায় ২৪-৪৮ ঘণ্টা ও ঢাকার বাইরে ২-৩ দিনে হোম ডেলিভারি"
    },
    {
      title: "৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি",
      desc: "পণ্য ক্ষতিগ্রস্ত থাকলে ৭ দিনের মধ্যে ১০০% ফ্রি এক্সচেঞ্জ"
    }
  ],
  faq: [
    {
      q: "চামচটি বারবার ভাঁজ করলে কি দাগ পড়বে বা ছিঁড়ে যাবে?",
      a: "একদমই না। এতে ব্যবহৃত হয়েছে DuraBend™ / Duraflex টেকনোলজি এবং প্রিমিয়াম ফুড-সেফ BPA-ফ্রি পলিমার, যা ১,০০,০০০ (১ লাখ) বারের বেশি ফোল্ড করলেও কোনো দাগ বা ক্র্যাক পড়বে না।"
    },
    {
      q: "মধু, ঘি বা তেলের মতো তরল উপাদান কি কোণা দিয়ে লিক করবে?",
      a: "না, এটি ১০০% লিক-প্রুফ (LeakProof for Wet & Dry) পেটেন্টেড ডিজাইনে তৈরি। তেল, মধু, দুধ বা গুঁড়া মসলা মাপার পর চামচটি ফ্ল্যাট করে এক টানে মুছে ডিশওয়াশারে বা ট্যাপের পানিতে ধুয়ে নেওয়া যায়।"
    },
    {
      q: "প্রতি সেটে কয়টি চামচ থাকে এবং পরিমাপের সাইজ কত কত?",
      a: "প্রতি সেটে ২টি ফোল্ডিং চামচ (বড় ও ছোট) দিয়ে মোট ৬টি সাইজ পাওয়া যায়:\n• বড় চামচে ৩টি মাপ: ২ টেবিল চামচ (৩০ মিলি), ১ টেবিল চামচ (১৫ মিলি), ১/২ টেবিল চামচ (৭.৫ মিলি)\n• ছোট চামচে ৩টি মাপ: ১ চা চামচ (৫ মিলি), ১/২ চা চামচ (২.৫ মিলি), ১/৪ চা চামচ (১.২৫ মিলি)"
    },
    {
      q: "এটি কি ডিশওয়াশার ও ম্যাগনেটিক স্টোরেজ ফ্রেন্ডলি?",
      a: "হ্যাঁ! এটি ডিশওয়াশার টপ-র‌্যাক সেফ (Top-rack Dishwasher Safe), দাগ-প্রতিরোধী এবং ম্যাগনেটিক স্টোরেজ সুবিধাযুক্ত। ফলে ড্রয়ারে বা ম্যাগনেটিক স্ট্রিপে খুব সহজে গুছিয়ে রাখা যায়।"
    },
    {
      q: "ডেলিভারির সময় কি প্যাকেট খুলে দেখে নেওয়ার সুযোগ আছে?",
      a: "হ্যাঁ, অবশ্যই! আমাদের ডেলিভারি ম্যানের সামনে প্রিমিয়াম গিফট বক্স প্যাকেট খুলে অরিজিনাল মেরুন রঙের Polygons চামচ চেক করে নিশ্চিত হয়ে সম্পূর্ণ মূল্য পরিশোধ করবেন।"
    },
    {
      q: "ডেলিভারি পেতে কতদিন সময় লাগবে এবং ডেলিভারি চার্জ কত?",
      a: "ঢাকা সিটির ভেতরে ২৪ থেকে ৪৮ ঘণ্টার মধ্যে (চার্জ ৳৬০) এবং ঢাকার বাইরে ২ থেকে ৩ কার্যদিবসের মধ্যে (চার্জ ৳১৩০)। তবে ২ বা ৩ সেট অর্ডার করলে সারাদেশে থাকছে ১০০% ফ্রি হোম ডেলিভারি।"
    },
    {
      q: "প্রোডাক্টে কোনো সমস্যা থাকলে রিটার্ন বা রিপ্লেসমেন্ট সুবিধা কেমন?",
      a: "আমরা দিচ্ছি ৭ দিনের সহজ রিপ্লেসমেন্ট গ্যারান্টি। ডেলিভারির সময় কোনো ত্রুটি পেলে আমাদের হেল্পলাইন বা WhatsApp-এ জানালেই সম্পূর্ণ ফ্রিতে রিপ্লেসমেন্ট পেয়ে যাবেন।"
    }
  ],
  whatsapp: {
    phoneNumber: "8801353892282",
    messagePrefix: "হ্যালো, আমি ওয়েবসাইট থেকে অর্ডার কনফার্ম করতে চাই। অর্ডার নম্বর: "
  }
};

async function initDatabase() {
  // Create products table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      page_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create orders table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      product_id INTEGER,
      product_slug TEXT,
      product_name TEXT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      delivery_zone TEXT NOT NULL,
      bundle_id TEXT,
      bundle_name TEXT,
      color_variant TEXT DEFAULT 'Red',
      quantity INTEGER DEFAULT 1,
      item_price REAL NOT NULL,
      delivery_charge REAL NOT NULL,
      total_amount REAL NOT NULL,
      order_status TEXT DEFAULT 'pending',
      pathao_consignment_id TEXT,
      pathao_tracking_code TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun(`ALTER TABLE orders ADD COLUMN color_variant TEXT DEFAULT 'Red'`);
  } catch (e) {
    // Column already exists
  }

  // Create settings table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default product if empty
  const defaultProduct = await dbGet('SELECT * FROM products WHERE slug = ?', ['origami-spoon']);
  if (!defaultProduct) {
    await dbRun(
      `INSERT INTO products (slug, title, is_default, page_data) VALUES (?, ?, ?, ?)`,
      [
        'origami-spoon',
        'Polygons 3-in-1 Folding Measuring Spoon Set (Set of 2 - 6 Sizes)',
        1,
        JSON.stringify(defaultOrigamiPageData)
      ]
    );
    console.log('Seeded default product: origami-spoon');
  }

  // Seed default settings
  const defaultSettings = [
    { key: 'admin_password', value: 'admin123' },
    { key: 'meta_pixel_id', value: '1997638254273409' },
    { key: 'meta_capi_token', value: 'EAAPJ5KufkmcBSQiO1W9ijQx2cSHtPNZCC2aCdkK8ROGyhLH3cIpxIShdNXs8B70PUIxugiSUBA8ZBWCg2bMxB0nPDtLfrOnZCvNVUqbsjqYkaBc4kHLUgNX2J7nyE1HIqYsh2MRC3KSlAVjvTeRPLG74yXnELvOkfsHZBuQosKrtEtveqt3XZB0yYAsM4lvyQyAZDZD' },
    { key: 'meta_test_event_code', value: '' },
    { key: 'pathao_base_url', value: 'https://courier-api-sandbox.pathao.com' },
    { key: 'pathao_client_id', value: '' },
    { key: 'pathao_client_secret', value: '' },
    { key: 'pathao_username', value: '' },
    { key: 'pathao_password', value: '' },
    { key: 'pathao_store_id', value: '' },
    { key: 'whatsapp_number', value: '8801353892282' }
  ];

  for (const s of defaultSettings) {
    const existing = await dbGet('SELECT * FROM settings WHERE key = ?', [s.key]);
    if (!existing) {
      await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  }
}

module.exports = {
  db,
  dbPath,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  defaultOrigamiPageData
};
