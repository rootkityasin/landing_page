const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect Turso Cloud Database URL (for Vercel Serverless / Cloud Persistence)
const rawTursoUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL || 'https://polygons-db-polygonsbd.aws-ap-south-1.turso.io';
const tursoUrl = (rawTursoUrl || '').replace(/^libsql:\/\//, 'https://');
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc5NTM3NDgsImlkIjoiMDFhMDRhNTgtYmUwMS03OGVkLThiZTQtOWM4YTZkZmY3MjFkIiwia2lkIjoiN1NSSkd0NTJrdndBYktFVlUwZ3QzU3VvRk92cmdyQkpqc0g0aUZOdTFXdyIsInJpZCI6IjRiZTExM2Y5LTEwMjQtNGUxMi1hMzg1LWY4YzllOTM1NDE1YSJ9.8rbgvUx-0B_OJnxY6_eOguD2AoVtbQP5mn3e74kHvdx3nMUnxmh0NFIsZw-nIT7qxtkd7y1RGxr-KIO51ufeBw';

let db = null;
let dbPath = path.join(__dirname, 'database.sqlite');
const isTurso = !!(tursoUrl && tursoAuthToken);

if (isTurso) {
  console.log('🚀 Connected to Turso Cloud SQLite Database at', tursoUrl);
} else {
  const sqlite3 = require('sqlite3').verbose();
  const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

  if (isVercel) {
    const tmpDbPath = path.join(os.tmpdir(), 'database.sqlite');
    const bundledDbPath = path.join(__dirname, 'database.sqlite');
    try {
      if (!fs.existsSync(tmpDbPath)) {
        if (fs.existsSync(bundledDbPath)) {
          fs.copyFileSync(bundledDbPath, tmpDbPath);
        }
      }
      dbPath = tmpDbPath;
    } catch (err) {
      dbPath = tmpDbPath;
    }
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to SQLite database at', dbPath, err.message);
    } else {
      console.log('Connected to SQLite database at', dbPath);
      db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA synchronous = NORMAL;');
        db.run('PRAGMA busy_timeout = 10000;');
        db.run('PRAGMA foreign_keys = ON;');
      });
    }
  });
}

// Native Serverless Turso HTTPS Pipeline Executor (Zero External Dependencies, Built-in https module)
const https = require('https');

function executeTursoHttps(sql, params = []) {
  const normParams = (Array.isArray(params) ? params : [params]).map(p => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'number') {
      return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
    }
    if (typeof p === 'boolean') return { type: 'integer', value: p ? '1' : '0' };
    return { type: 'text', value: String(p) };
  });

  const parsedUrl = new URL(`${tursoUrl}/v2/pipeline`);
  const postData = JSON.stringify({
    requests: [
      {
        type: 'execute',
        stmt: {
          sql,
          args: normParams
        }
      },
      { type: 'close' }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tursoAuthToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Turso HTTPS error (${res.statusCode}): ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            const execResult = parsed.results && parsed.results[0];
            if (execResult && execResult.type === 'error') {
              return reject(new Error(`Turso SQL error: ${execResult.error?.message || JSON.stringify(execResult.error)}`));
            }
            const result = execResult?.response?.result;
            if (!result) {
              return resolve({ rows: [], lastID: 0, changes: 0 });
            }
            const cols = (result.cols || []).map(c => c.name);
            const rows = (result.rows || []).map(rowArray => {
              const obj = {};
              cols.forEach((colName, idx) => {
                const cell = rowArray[idx];
                if (!cell || cell.type === 'null') {
                  obj[colName] = null;
                } else if (cell.type === 'integer' || cell.type === 'float') {
                  obj[colName] = Number(cell.value);
                } else {
                  obj[colName] = cell.value;
                }
              });
              return obj;
            });
            resolve({
              rows,
              lastID: result.last_insert_rowid !== null && result.last_insert_rowid !== undefined ? Number(result.last_insert_rowid) : 0,
              changes: result.affected_row_count || 0
            });
          } catch (parseErr) {
            reject(parseErr);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Turso HTTPS request timeout (10s)'));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Universal dbRun (Works on both Turso and SQLite3)
const dbRun = async (sql, params = []) => {
  if (isTurso) {
    const res = await executeTursoHttps(sql, params);
    return {
      lastID: res.lastID,
      changes: res.changes
    };
  }
  const normParams = (Array.isArray(params) ? params : [params]).map(p => (p === undefined ? null : p));
  return new Promise((resolve, reject) => {
    db.run(sql, normParams, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Universal dbGet (Works on both Turso and SQLite3)
const dbGet = async (sql, params = []) => {
  if (isTurso) {
    const res = await executeTursoHttps(sql, params);
    return (res.rows && res.rows.length > 0) ? res.rows[0] : null;
  }
  const normParams = (Array.isArray(params) ? params : [params]).map(p => (p === undefined ? null : p));
  return new Promise((resolve, reject) => {
    db.get(sql, normParams, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

// Universal dbAll (Works on both Turso and SQLite3)
const dbAll = async (sql, params = []) => {
  if (isTurso) {
    const res = await executeTursoHttps(sql, params);
    return res.rows || [];
  }
  const normParams = (Array.isArray(params) ? params : [params]).map(p => (p === undefined ? null : p));
  return new Promise((resolve, reject) => {
    db.all(sql, normParams, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Default Landing Page Data
const defaultOrigamiPageData = {
  meta: {
    pageTitle: "Polygons 3-in-1 Folding Measuring Spoon | Smart Kitchen Innovation",
    pixelId: "1997638254273409",
    capiToken: "EAAPJ5KufkmcBSQiO1W9ijQx2cSHtPNZCC2aCdkK8ROGyhLH3cIpxIShdNXs8B70PUIxugiSUBA8ZBWCg2bMxB0nPDtLfrOnZCvNVUqbsjqYkaBc4kHLUgNX2J7nyE1HIqYsh2MRC3KSlAVjvTeRPLG74yXnELvOkfsHZBuQosKrtEtveqt3XZB0yYAsM4lvyQyAZDZD",
    testEventCode: "",
    metaDescription: "রান্না ও বেকিংয়ে নিখুঁত মাপের জন্য অরিজিনাল ৩-ইন-১ ফোল্ডিং মেজারিং চামচ। মাত্র ২টি ফ্ল্যাট চামচে ৬টি মাপ, ইজি টু ক্লিন ও ক্যাশ অন ডেলিভারি সুবিধা। ৪৫% ডিসকাউন্টে এখনই অর্ডার করুন!",
    whatsappNumber: "8801353892282"
  },
  whatsappNumber: "8801353892282",
  topBar: {
    text: "🔥 বিশেষ অফার: সীমিত সময়ের জন্য ৪৫% পর্যন্ত ছাড় + ক্যাশ অন ডেলিভারি!",
    show: true
  },
  hero: {
    headline: "রান্না ও বেকিংয়ে নিখুঁত মাপের 3-in-1 ফোল্ডিং মেজারিং চামচ",
    subheadline: "চামচ হারিয়ে যাওয়া বা ড্রয়ারের জটলা শেষ! মাত্র ২টি ফ্ল্যাট চামচে পেয়ে যান মোট ৬টি নিখুঁত পরিমাপ।",
    highlights: [
      "🛡️ DuraBend™ টেকনোলজি (১০০,০০০+ ফোল্ড): ফুড-সেফ পলিমার যা কখনো ভাঙবে না বা বাঁকা হবে না।",
      "💧 ১ সেকেন্ডে ফ্ল্যাট ও ওয়াশ: ঘন তেল, মধু বা মসলা লেগে থাকবে না, কলে ধুয়ে নিমিষেই পরিষ্কার।",
      "🧲 জিরো-স্টোরেজ স্পেস: একদম কাগজের মতো ফ্ল্যাট হয়ে যায়, ড্রয়ারে জায়গা নেবে না।"
    ],
    ratingText: "৪.৯/৫ রেটিং (১৫০+ ভেরিফাইড রিভিউ)",
    regularPrice: 1200,
    discountedPrice: 666,
    discountBadge: "৪৫% ছাড়",
    ctaText: "এখনই অর্ডার করুন",
    mediaType: "image",
    mediaUrl: "/images/post1.jpeg",
    secondaryMediaUrl: "/images/post2.png",
    showPrimary: true,
    showSecondary: true,
    additionalGallery: [
      { url: "/images/poster3.webp", show: true },
      { url: "/images/poster4.webp", show: true },
      { url: "/images/post1.webp", show: true },
      { url: "/images/post2.webp", show: true }
    ],
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
    badge: "🎥 Video Demonstration",
    title: "ভিডিওতে দেখুন এটি কীভাবে কাজ করে ও সহজে ব্যবহার করবেন",
    subtitle: "",
    videoUrl: "https://www.youtube.com/shorts/XbY3X_GNwbk",
    posterUrl: "/uploads/media-1787681475090-937220178.webp"
  },
  whatsIncluded: {
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
  },
  bundles: [
    {
      id: "bundle_1",
      name: "১ সেট — ৳৬৬৬",
      badge: "১ সেট (বিজ্ঞাপনের অফার)",
      price: 666,
      regularPrice: 1200,
      description: "১টি বড় চামচ (Tablespoon) + ১টি ছোট চামচ (Teaspoon)",
      deliveryText: "ডেলিভারি চার্জ: ঢাকা ৬০৳, ঢাকার বাইরে ১৩০৳",
      quantity: 1,
      freeDelivery: false
    },
    {
      id: "bundle_2",
      name: "২ সেট — ৳১,১৯৯",
      badge: "২ সেট (সারা দেশে ফ্রি ডেলিভারি) 🔥",
      price: 1199,
      regularPrice: 2400,
      description: "মোট ৪টি ফোল্ডিং চামচ (২টি বড় + ২টি ছোট) — নিজের কিচেন ও প্রিয়জনকে উপহারের জন্য সেরা",
      deliveryText: "সারা বাংলাদেশে হোম ডেলিভারি একদম ফ্রি!",
      quantity: 2,
      freeDelivery: true,
      popular: true
    },
    {
      id: "bundle_3",
      name: "৩ সেট — ৳১,৬৫০",
      badge: "৩ সেট (মেগা সেভার কম্বো) 🏆",
      price: 1650,
      regularPrice: 3600,
      description: "মোট ৬টি ফোল্ডিং চামচ — মেগা ডিসকাউন্ট + ফ্রি ডেলিভারি",
      deliveryText: "সারা বাংলাদেশে হোম ডেলিভারি একদম ফ্রি!",
      quantity: 3,
      freeDelivery: true
    }
  ],
  checkout: {
    title: "আপনার পছন্দের প্যাকেজটি বেছে নিন",
    subtitle: "২ বা ৩ সেটের অর্ডারে থাকছে সারাদেশে ১০০% ফ্রি হোম ডেলিভারি",
    formTitle: "অর্ডার কনফার্ম করতে আপনার তথ্য দিন",
    formSubtitle: "🔒 Cash on Delivery — পণ্য হাতে পেয়ে চেক করে টাকা পরিশোধ করবেন",
    deliveryDhaka: 60,
    deliveryOutside: 130,
    deliveryInsideDhaka: 60,
    deliveryOutsideDhaka: 130
  },
  reviews: [
    {
        "name": "Maimuna Nova",
        "location": "Tongi Mirer Bazar",
        "rating": 5,
        "date": "৩ দিন আগে",
        "comment": "প্রথমে ভেবেছিলাম  আর দশটা measuring spoon এর মতোই হবে। কিন্তু হাতে পাওয়ার পর বেশ ভালো লেগেছে।মামনিকে গিফট দিয়েছি ।",
        "verified": true
    },
    {
        "name": "নুসরাত জাহান",
        "location": "উত্তরা, ঢাকা",
        "rating": 4,
        "date": "৫ দিন আগে",
        "comment": "আমি baking করি, তাই মাপজোক প্রায় প্রতিদিনই লাগে। আগে কয়েকটা spoon আলাদা করে রাখতে হতো। এটা দিয়ে কাজ অনেক সহজ হয়েছে, আর ফ্রিজে লাগিয়ে রাখতে পারি , জিনিসটা বেশ practical .Productটা simple কিন্তু smart। ৩ ধরনের measurement একসাথে পাওয়াটা convenient। বিশেষ করে baking করার সময় খুব কাজে লাগছে। যারা kitchen space বাঁচাতে চান, তাদের ভালো লাগবে মনে হয়।",
        "verified": true
    },
    {
        "name": "Sumaiya Sharmin",
        "location": "জিইসি, চট্টগ্রাম",
        "rating": 3,
        "date": "১ সপ্তাহ আগে",
        "comment": "আমার রান্নাঘরের ড্রয়ার সবসময় জিনিসে ভরা থাকে। তাই ভাঁজ করে সমান করে রাখা যায় দেখে নিয়েছিলাম। এখন বুঝতে পারছি জায়গা বাঁচানোর জন্য সুবিধাটা সত্যিই কাজে লাগে। রান্না আর বেকিং দুটোর জন্যই ব্যবহার করছি।",
        "verified": true
    },
    {
        "name": "আসমা",
        "location": "সিলেট সদর",
        "rating": 5,
        "date": "১ সপ্তাহ আগে",
        "comment": "অনলাইনে ভিডিওতে দেখে অর্ডার করেছিলাম, সত্যি বলতে খুব বেশি আশা ছিল না। কিন্তু product হাতে পেয়ে ভালোই লেগেছে। Magnetic feature টা বেশ useful, আর মাপ নেওয়াটাও easy।",
        "verified": true
    },
    {
        "name": "Nafisa Islam",
        "location": "Tejgaon Dhaka",
        "rating": 5,
        "date": "২ সপ্তাহ আগে",
        "comment": "যেটা সবচেয়ে ভালো লেগেছে সেটা হলো জায়গা নেয় খুব কম। ধুয়ে ফেলাও সহজ।",
        "verified": true
    },
    {
        "name": "Pakhi",
        "location": "Mogbazar",
        "rating": 4,
        "date": "২ সপ্তাহ আগে",
        "comment": "Honestly beshi expectation niye order kori nai 😄 Kintu product ta actually besh kajer. Magnetic howay fridge er pashe lagiye rakhi. Dorkar hole sathe sathei niye use kora jay. Simple but useful ekta jinis.",
        "verified": true
    },
    {
        "name": "Yasir Araf",
        "location": "Rangpure",
        "rating": 5,
        "date": "২ সপ্তাহ আগে",
        "comment": "Khubi vlo ekta product ,abr bou er jonno niyechi .",
        "verified": true
    }
],
  showFaq: true,
  faq: [
    {
      question: "পণ্য হাতে পেয়ে কি দেখে টাকা দেওয়া যাবে?",
      answer: "হ্যাঁ, ১০০% ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। ডেলিভারি ম্যানের সামনে প্যাকেট খুলে চামচের কোয়ালিটি নিশ্চিত হয়ে তারপর টাকা পরিশোধ করবেন।"
    },
    {
      question: "ফোল্ডিং জয়েন্ট কি বারবার ভাজ করলে ভেঙে যাওয়ার ঝুঁকি আছে?",
      answer: "না, এটি প্রিমিয়াম DuraBend™ ফুড-গ্রেড পলিমার দিয়ে তৈরি, যা ল্যাব টেস্টে ১০০,০০০ বারের বেশি ফোল্ডিং টেস্ট করা হয়েছে। এটি সহজে ভাঙবে না বা ক্ষয়ে যাবে না।"
    },
    {
      question: "১ সেটে মোট কয়টি চামচ থাকে এবং কী কী মাপ পাওয়া যায়?",
      answer: "প্রতি ১ সেটে মোট ২টি চামচ থাকে: ১টি বড় চামচ (Tablespoon: ২ চামচ, ১ চামচ, ১/২ চামচ) এবং ১টি ছোট চামচ (Teaspoon: ১ চামচ, ১/২ চামচ, ১/৪ চামচ)। অর্থাৎ মোট ৬টি পরিমাপ পাওয়া যাবে।"
    },
    {
      question: "ডেলিভারি পেতে কতদিন সময় লাগবে?",
      answer: "ঢাকার ভেতরে ২৪ থেকে ৪৮ ঘণ্টার মধ্যে এবং ঢাকার বাইরে ২ থেকে ৩ দিনের মধ্যে পাঠাও কুরিয়ারের মাধ্যমে আপনার ঠিকানায় সরাসরি পৌঁছে দেওয়া হবে।"
    }
  ],
  guarantees: [
    {
      icon: "/images/trust-cod.svg",
      title: "Cash on Delivery",
      desc: "পণ্য হাতে পেয়ে চেক করে নিশ্চিত হয়ে মূল্য পরিশোধ করুন।"
    },
    {
      icon: "/images/trust-fast.svg",
      title: "দ্রুততম ডেলিভারি",
      desc: "সারা বাংলাদেশে দ্রুততম সময়ে হোম ডেলিভারি।"
    },
    {
      icon: "/images/trust-quality.svg",
      title: "১০০% অরিজিনাল কোয়ালিটি",
      desc: "প্রিমিয়াম ফুড-গ্রেড ম্যাটেরিয়াল ও লিক-প্রুফ ডিজাইন।"
    },
    {
      icon: "/images/trust-replace.svg",
      title: "৭ দিনের রিপ্লেসমেন্ট",
      desc: "যেকোনো সমস্যায় ৭ দিনের মধ্যে ফ্রি রিপ্লেসমেন্ট।"
    }
  ]
};

// Database Schema Initializer
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      page_data TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      bundle_id TEXT NOT NULL,
      bundle_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      item_price REAL NOT NULL,
      delivery_charge REAL NOT NULL,
      total_amount REAL NOT NULL,
      order_status TEXT DEFAULT 'pending',
      pathao_consignment_id TEXT,
      pathao_tracking_code TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      color_variant TEXT DEFAULT 'Red'
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Create default origami spoon product if table is empty
  const count = (await dbGet('SELECT COUNT(*) as count FROM products'))?.count || 0;
  if (count === 0) {
    await dbRun(
      'INSERT INTO products (title, slug, page_data, is_default) VALUES (?, ?, ?, ?)',
      [
        'রান্না ও বেকিংয়ে নিখুঁত মাপের 3-in-1 ফোল্ডিং মেজারিং চামচ',
        'origami-spoon',
        JSON.stringify(defaultOrigamiPageData),
        1
      ]
    );
    console.log('Created default product: origami-spoon');
  }

  // Insert default settings if not exists
  const defaultSettings = [
    { key: 'admin_password', value: 'poly1234' },
    { key: 'pathao_base_url', value: 'https://courier-api-sandbox.pathao.com' },
    { key: 'pathao_client_id', value: '' },
    { key: 'pathao_client_secret', value: '' },
    { key: 'pathao_username', value: '' },
    { key: 'pathao_password', value: '' },
    { key: 'pathao_store_id', value: '' }
  ];

  for (const s of defaultSettings) {
    const existing = await dbGet('SELECT * FROM settings WHERE key = ?', [s.key]);
    if (!existing) {
      await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  }

  // Restore orders from persistent backup log (if running locally or on server)
  await syncOrdersBackupToDatabase();
}

async function syncOrdersBackupToDatabase() {
  try {
    const backupFile = path.join(__dirname, 'orders_backup.jsonl');
    if (!fs.existsSync(backupFile)) return;

    const lines = fs.readFileSync(backupFile, 'utf8').split('\n').filter(l => l.trim());
    let restoredCount = 0;

    for (const line of lines) {
      try {
        const o = JSON.parse(line);
        if (o && o.order_number && !o.order_number.startsWith('TEST-')) {
          const existing = await dbGet('SELECT id FROM orders WHERE order_number = ?', [o.order_number]);
          if (!existing) {
            await dbRun(
              `INSERT INTO orders (
                order_number, product_id, product_slug, product_name,
                customer_name, phone, address, delivery_zone,
                bundle_id, bundle_name, color_variant, quantity,
                item_price, delivery_charge, total_amount, order_status,
                pathao_consignment_id, pathao_tracking_code, ip_address, user_agent, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
              [
                o.order_number, o.product_id || 1, o.product_slug || 'origami-spoon', o.product_name || 'Polygons Spoon',
                o.customer_name, o.phone, o.address, o.delivery_zone,
                o.bundle_id || 'bundle_1', o.bundle_name || 'Standard Package', o.color_variant || 'Red', o.quantity || 1,
                o.item_price || 0, o.delivery_charge || 0, o.total_amount || 0, o.order_status || 'pending',
                o.pathao_consignment_id || null, o.pathao_tracking_code || null,
                o.ip_address || null, o.user_agent || null, o.created_at || null
              ]
            );
            restoredCount++;
          }
        }
      } catch (err) { /* skip */ }
    }
    if (restoredCount > 0) {
      console.log(`✅ Restored ${restoredCount} persistent order(s) from orders_backup.jsonl into database`);
    }
  } catch (err) {
    console.warn('Backup sync notice:', err.message);
  }
}

module.exports = {
  db,
  dbPath,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  syncOrdersBackupToDatabase,
  defaultOrigamiPageData
};
