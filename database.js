const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

// Helper for promise-based queries
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const defaultOrigamiPageData = {
  meta: {
    pageTitle: "Polygons 4-in-1 Folding Measuring Spoon | ফ্ল্যাট ফোল্ডিং মেজারিং চামচ",
    pixelId: "",
    metaCapiToken: "",
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
    headline: "রান্না ও বেকিংয়ে নিখুঁত মাপের ৪-ইন-1 ফোল্ডিং মেজারিং চামচ",
    subheadline: "1টি চামচেই ৪টি নিখুঁত পরিমাপ এবং 1 সেকেন্ডে ফ্ল্যাট করে তেল-মধু পরিষ্কারের আধুনিক সল্যুশন।",
    highlights: [
      "⚡ ৪টি সাইজ 1টি চামচে: 1টি চামচ দিয়েই পাবেন ৪টি ভিন্ন পরিমাপ।",
      "🍯 1 সেকেন্ডে ইজি ক্লিন: ফ্ল্যাট করে এক টানে সমস্ত তেল বা মধু পরিষ্কার।",
      "🛡️ 100% ফুড গ্রেড পলিমার: প্রিমিয়াম কোয়ালিটি ও আনব্রেকেবল মেটেরিয়াল।"
    ],
    ratingText: "৪.৯/৫ রেটিং (৩৫০+ ভেরিফাইড রিভিউ)",
    regularPrice: 1100,
    discountedPrice: 666,
    discountBadge: "৪০% ছাড়",
    ctaText: "এখনই অর্ডার করুন",
    mediaType: "image",
    mediaUrl: "/images/post1.jpeg",
    secondaryMediaUrl: "/images/post2.png",
    mediaPoster: ""
  },
  problemSolution: {
    title: "কেন পুরনো মেজারিং চামচগুলো আপনার কিচেনের বিরক্তির কারণ?",
    subtitle: "সাধারণ চামচের সমস্যা বনাম আমাদের ৪-ইন-1 অরিগামি স্পুনের আধুনিক সমাধান",
    cards: [
      {
        problemTitle: "❌ ড্রয়ারে জায়গা নষ্ট ও হারিয়ে যাওয়া",
        problemDesc: "সাধারণ প্লাস্টিক চামচগুলো রিংয়ের ভেতর আটকে থাকে, ড্রয়ার খুললে জটলা পাকায় এবং কাজের সময় হারিয়ে যায়।",
        solutionTitle: "👉 একদম স্লিম ও ফ্ল্যাট ডিজাইন",
        solutionDesc: "ব্যবহার না করলে এটি কাগজের মতো একদম ফ্ল্যাট থাকে—কিচেন ড্রয়ারে শূন্য (০%) জায়গা নেয়।"
      },
      {
        problemTitle: "❌ তেল, মধু ও পিনাট বাটার নষ্ট হওয়া",
        problemDesc: "ঘন বা আঠালো উপাদান সাধারণ চামচের কোণায় আটকে থাকে, আঙুল বা চামচ দিয়ে খুঁচিয়েও পুরোটা নামানো যায় না।",
        solutionTitle: "👉 ফ্ল্যাট স্প্যাটুলা ওয়াইপ টেকনোলজি",
        solutionDesc: "ফ্ল্যাট করে এক টানে সমস্ত মধু, ঘি বা তেল সম্পূর্ণ পরিষ্কার করে কড়াইতে নামিয়ে দেয়া যায়।"
      },
      {
        problemTitle: "❌ ধুতে সময় লাগা ও মসলা জমে থাকা",
        problemDesc: "সাধারণ চামচের গভীর কোনা-কাঞ্চিতে মসলা ও হলুদ জমে থাকে, যা স্পঞ্জ দিয়ে সহজে পরিষ্কার হয় না।",
        solutionTitle: "👉 1 সেকেন্ডে ট্যাপের পানিতে ক্লিন",
        solutionDesc: "সোজা ফ্ল্যাট করে কলের পানির নিচে ধরলেই এক পলকে সম্পূর্ণ নতুনের মতো পরিষ্কার হয়ে যায়।"
      }
    ]
  },
  howItWorks: {
    title: "কীভাবে মাত্র ৩টি সহজ ধাপে ব্যবহার করবেন?",
    subtitle: "কোনো ঝামেলা ছাড়াই মাত্র 1 সেকেন্ডে সাইজ অ্যাডজাস্ট ও ক্লিন করুন",
    steps: [
      {
        number: "০1",
        title: "চাপ দিয়ে সাইজ তৈরি করুন (Pinch to Size)",
        desc: "হ্যান্ডেলের দাগ অনুযায়ী দুই পাশে চাপ দিলেই ভাঁজ হয়ে তৈরি হবে 1/৪ চামচ, 1/২ চামচ বা 1 টেবিল চামচ।",
        image: "/images/step1.svg"
      },
      {
        number: "০২",
        title: "মাপ মতো তুলে নিন (Scoop & Level)",
        desc: "গুঁড়া মসলা, লবণ, বেকিং পাউডার কিংবা তরল তেল নিখুঁত মাপে কোনো ছিটে যাওয়া ছাড়াই তুলুন।",
        image: "/images/step2.svg"
      },
      {
        number: "০৩",
        title: "ফ্ল্যাট করে ধুয়ে রাখুন (Flat Clean & Store)",
        desc: "ব্যবহার শেষে ফ্ল্যাট করে ট্যাপের পানিতে ধুয়ে বইয়ের মতো যেকোনো ড্রয়ারে রেখে দিন।",
        image: "/images/step3.svg"
      }
    ]
  },
  whatsIncluded: {
    badge: "Complete 1 Set Box",
    title: "আমাদের 1 সেট প্রোডাক্টে কী কী পাচ্ছেন?",
    subtitle: "প্রতি 1 সেটে থাকবে মোট ২টি স্মার্ট ফোল্ডিং চামচ — যাতে সহজেই পেয়ে যাবেন মোট ৮টি নিখুঁত পরিমাপ",
    largeSpoonTitle: "1. বড় মেজারিং চামচ",
    largeSpoonBadge: "৪টি মাপ (Tablespoon)",
    largeSpoonUsage: "তেল, সস, বেকিং ব্যাটার, ময়দা ও চিনির সঠিক মাপের জন্য।",
    smallSpoonTitle: "২. ছোট মেজারিং চামচ",
    smallSpoonBadge: "৪টি মাপ (Teaspoon)",
    smallSpoonUsage: "লবণ, গুঁড়া মসলা, বেকিং পাউডার ও শিশুদের ওষুধের সঠিক মাপ।",
    bannerTitle: "মোট ৮টি ভিন্ন পরিমাপ মাত্র ২টি ফ্ল্যাট চামচে!",
    bannerDesc: "কোনো বাড়তি বাটি বা ভারী স্কেলের ঝামেলা ছাড়াই রান্নাঘরের যেকোনো ড্রয়ারে ফ্ল্যাট রেখে দিন।"
  },
  comparison: {
    title: "কেন এটি সাধারণ চামচের চেয়ে বহুগুণে সেরা?",
    subtitle: "সাধারণ প্লাস্টিক চামচ ও ডিজিটাল স্কেলের সাথে সরাসরি তুলনা",
    imageUrl: "/uploads/media-1787690411261-932816281.png"
  },
  bundles: [
    {
      id: "bundle_1",
      name: "1 সেট (ট্রায়াল প্যাক)",
      badge: "ট্রায়াল প্যাক",
      desc: "1টি বড় চামচ + 1টি ছোট চামচ",
      price: 666,
      regularPrice: 1100,
      savings: "৪৩৪ টাকা ছাড়",
      freeDelivery: false,
      isPopular: false
    },
    {
      id: "bundle_2",
      name: "২ সেট (জনপ্রিয় ফ্যামিলি প্যাক)",
      badge: "⭐ সর্বাধিক জনপ্রিয়",
      desc: "২টি বড় চামচ + ২টি ছোট চামচ (ফ্যামিলি ও গিফট প্যাক)",
      price: 1199,
      regularPrice: 2200,
      savings: "1০০1 টাকা ছাড় + ফ্রি ডেলিভারি",
      freeDelivery: true,
      isPopular: true
    },
    {
      id: "bundle_3",
      name: "৩ সেট (সুপার সেভার প্যাক)",
      badge: "🔥 বেস্ট ভ্যালু",
      desc: "৩টি বড় চামচ + ৩টি ছোট চামচ (নিজের ও আত্মীয়দের জন্য)",
      price: 1699,
      regularPrice: 3300,
      savings: "1৬০1 টাকা ছাড় + ফ্রি ডেলিভারি",
      freeDelivery: true,
      isPopular: false
    }
  ],
  checkout: {
    formTitle: "অর্ডার কনফার্ম করতে নিচের তথ্যগুলো পূরণ করুন",
    formSubtitle: "🔒 ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে চেক করে টাকা পরিশোধ করবেন",
    deliveryDhaka: 70,
    deliveryOutside: 130,
    submitBtnText: "অর্ডার কনফার্ম করুন",
    guaranteeNotice: "ডেলিভারি ম্যানের সামনে প্রোডাক্ট দেখে রিসিভ করতে পারবেন।"
  },
  reviews: [
    {
      name: "সুমি আক্তার",
      location: "গুলশান-২, ঢাকা",
      rating: 5,
      comment: "Baking lover হিসেবে এটা আমার জন্য লাইফ সেভার। আগে আলাদা ৪টা স্পুন ড্রয়ারে খুঁজতে হতো, এখন এই 1টা দিয়ে 1/৪ চামচ থেকে 1 টেবিল চামচ পর্যন্ত সব মেপে নিই। মেটেরিয়াল কোয়ালিটি অনেক প্রিমিয়াম।",
      verified: true,
      date: "৩ দিন আগে"
    },
    {
      name: "ডা. রাশেদুল হাসান",
      location: "ধানমন্ডি, ঢাকা",
      rating: 5,
      comment: "বাচ্চাদের ওষুধের সঠিক পরিমাপ আর সকালের ডায়েট ফুডের ওটস ও চিয়া সিড মেপে নেওয়ার জন্য দারুণ। ব্যবহারের পর এক টানে ধুয়ে ফেলা যায়, কোনো আঠালো ভাব বা ময়লা জমে থাকে না।",
      verified: true,
      date: "৫ দিন আগে"
    },
    {
      name: "নুসরাত জাহান",
      location: "পাঁচলাইশ, চট্টগ্রাম",
      rating: 5,
      comment: "মধু আর ঘি নেওয়ার পর সাধারণ চামচ ধুতে গরম পানি আর ঘষাঘষি লাগতো। এটা ফ্ল্যাট করে স্প্যাচুলার মতো কড়াইতে চেঁছে নামিয়ে টিস্যু দিয়ে মুছলেই সাফ! অসম্ভব কাজের গ্যাজেট।",
      verified: true,
      date: "1 সপ্তাহ আগে"
    },
    {
      name: "তানজিনা তাবাসসুম",
      location: "উপশহর, সিলেট",
      rating: 5,
      comment: "সোশ্যাল মিডিয়ায় ভিডিও দেখে অর্ডার করেছিলাম। সত্যি বলতে ছবির চেয়ে বাস্তবেও দেখতে অনেক আকর্ষণীয় ও মজবুত। ২ সেটের ফ্যামিলি প্যাক নিয়েছিলাম, একদম ফ্রি ডেলিভারিতে পেয়েছি।",
      verified: true,
      date: "1 সপ্তাহ আগে"
    },
    {
      name: "ইশতিয়াক আহমেদ",
      location: "সুগন্ধা, খুলনা",
      rating: 5,
      comment: "আমার বেকিং শপের জন্য ২ সেট অর্ডার করেছিলাম। নিখুঁত মাপ এবং খুব মজবুত পলিমার। ডেলিভারি ম্যানের সামনে প্যাকেট খুলে চেক করে টাকা দিয়েছি। 1০০% সন্তুষ্ট।",
      verified: true,
      date: "২ সপ্তাহ আগে"
    },
    {
      name: "সাবিহা পারভীন",
      location: "উত্তরা সেক্টর ৭, ঢাকা",
      rating: 5,
      comment: "রান্নাঘরে চামচের ড্রয়ারে জটলা সবসময় অপছন্দ ছিল। এটা কাগজের মতো পাতলা হয়ে এক কোণে পড়ে থাকে। অসাধারণ ইনোভেশন, সবাইকে নেওয়ার জন্য সাজেস্ট করবো।",
      verified: true,
      date: "২ সপ্তাহ আগে"
    }
  ],
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
      desc: "পণ্য ক্ষতিগ্রস্ত থাকলে ৭ দিনের মধ্যে 100% ফ্রি এক্সচেঞ্জ"
    }
  ],
  faq: [
    {
      q: "চামচটি বারবার ভাঁজ করলে কি দাগ পড়বে বা ছিঁড়ে যাবে?",
      a: "একদমই না। এটি প্রিমিয়াম ফুড-গ্রেড BPA-ফ্রি TPE মেটেরিয়াল ও ট্রায়াঙ্গেল হিঞ্জ টেকনোলজিতে তৈরি, যা 1০০,০০০ বারের বেশি ফোল্ড করলেও কোনো দাগ, ভাঁজের দাগ বা চিড় ধরবে না।"
    },
    {
      q: "মধু, ঘি বা তেলের মতো আঠালো জিনিস সহজে কীভাবে পরিষ্কার করবো?",
      a: "চামচটি সম্পূর্ণ ফ্ল্যাট করে কড়াইতে সম্পূর্ণ মধু বা তেল চেঁছে নামিয়ে নিন। এরপর সাধারণ সাবান-পানি দিয়ে ধুয়ে নিলে বা টিস্যু দিয়ে ওয়াইপ করলেই 1 সেকেন্ডে নতুনের মতো পরিষ্কার হয়ে যাবে।"
    },
    {
      q: "এর চারটি পরিমাপের সাইজ কত কত?",
      a: "হ্যান্ডেলে সুস্পষ্ট মার্কিং দেওয়া রয়েছে: 1/৪ চা চামচ (1.25 ml), 1/২ চা চামচ (2.5 ml), 1 চা চামচ (5 ml), এবং 1 টেবিল চামচ (15 ml)। বড় চামচ ও ছোট চামচ—২টি মিলে যেকোনো তরল বা গুঁড়ো উপাদান নিখুঁত মাপা যায়।"
    },
    {
      q: "ডেলিভারির সময় কি প্যাকেট খুলে দেখে নেওয়ার সুযোগ আছে?",
      a: "হ্যাঁ, অবশ্যই! আমাদের ডেলিভারি ম্যানের সামনে প্যাকেট খুলে অরিজিনাল প্রোডাক্ট ও সাইজ চেক করে নিশ্চিত হয়ে তারপর সম্পূর্ণ মূল্য ক্যাশ অন ডেলিভারিতে পরিশোধ করবেন।"
    },
    {
      q: "ডেলিভারি পেতে কতদিন সময় লাগবে এবং ডেলিভারি চার্জ কত?",
      a: "ঢাকা সিটির ভেতরে ২৪ থেকে ৪৮ ঘণ্টার মধ্যে (চার্জ ৳৭০) এবং ঢাকার বাইরে ২ থেকে ৩ কার্যদিবসের মধ্যে (চার্জ ৳1৩০)। তবে ২ বা ৩ সেট অর্ডার করলে সারাদেশে থাকছে 100% ফ্রি হোম ডেলিভারি।"
    },
    {
      q: "প্রোডাক্টে কোনো সমস্যা থাকলে রিটার্ন বা রিপ্লেসমেন্ট সুবিধা কেমন?",
      a: "আমরা দিচ্ছি ৭ দিনের সহজ রিপ্লেসমেন্ট গ্যারান্টি। ডেলিভারির সময় কোনো ত্রুটি পেলে আমাদের হেল্পলাইন বা WhatsApp-এ জানালেই আমরা সম্পূর্ণ ফ্রিতে নতুন প্রোডাক্ট পৌঁছে দেবো।"
    }
  ],
  whatsapp: {
    phoneNumber: "8801700000000",
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
        'Origami 4-in-1 Folding Measuring Spoon Set',
        1,
        JSON.stringify(defaultOrigamiPageData)
      ]
    );
    console.log('Seeded default product: origami-spoon');
  }

  // Seed default settings
  const defaultSettings = [
    { key: 'admin_password', value: 'admin123' },
    { key: 'meta_pixel_id', value: '' },
    { key: 'meta_capi_token', value: '' },
    { key: 'meta_test_event_code', value: '' },
    { key: 'pathao_base_url', value: 'https://courier-api-sandbox.pathao.com' },
    { key: 'pathao_client_id', value: '' },
    { key: 'pathao_client_secret', value: '' },
    { key: 'pathao_username', value: '' },
    { key: 'pathao_password', value: '' },
    { key: 'pathao_store_id', value: '' },
    { key: 'whatsapp_number', value: '8801700000000' }
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
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  defaultOrigamiPageData
};
