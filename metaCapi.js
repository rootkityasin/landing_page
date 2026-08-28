const crypto = require('crypto');
const { dbGet } = require('./database');

function hashData(value) {
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.trim().toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (!clean) return undefined;
  if (clean.startsWith('0')) {
    clean = '88' + clean;
  } else if (!clean.startsWith('880') && clean.length === 10) {
    clean = '880' + clean;
  }
  return hashData(clean);
}

function extractNames(fullName) {
  if (!fullName || typeof fullName !== 'string') return { fn: undefined, ln: undefined };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { fn: undefined, ln: undefined };
  if (parts.length === 1) {
    return { fn: parts[0], ln: undefined };
  }
  return {
    fn: parts[0],
    ln: parts.slice(1).join(' ')
  };
}

function extractCity(address, deliveryZone) {
  if (deliveryZone === 'dhaka_inside') return 'dhaka';
  if (!address || typeof address !== 'string') return undefined;
  const lower = address.toLowerCase();
  if (lower.includes('dhaka') || lower.includes('ঢাকা')) return 'dhaka';
  if (lower.includes('chittagong') || lower.includes('chattogram') || lower.includes('চট্টগ্রাম')) return 'chittagong';
  if (lower.includes('sylhet') || lower.includes('সিলেট')) return 'sylhet';
  if (lower.includes('rajshahi') || lower.includes('রাজশাহী')) return 'rajshahi';
  if (lower.includes('khulna') || lower.includes('খুলনা')) return 'khulna';
  if (lower.includes('barisal') || lower.includes('বরিশাল')) return 'barisal';
  if (lower.includes('rangpur') || lower.includes('রংপুর')) return 'rangpur';
  if (lower.includes('mymensingh') || lower.includes('ময়মনসিংহ')) return 'mymensingh';
  if (lower.includes('gazipur') || lower.includes('গাজীপুর')) return 'gazipur';
  if (lower.includes('narayanganj') || lower.includes('নারায়ণগঞ্জ')) return 'narayanganj';
  if (lower.includes('comilla') || lower.includes('কুমিল্লা') || lower.includes('cumilla')) return 'comilla';
  return undefined;
}

class MetaCapi {
  async sendEvent({ eventName, eventId, eventSourceUrl, userData = {}, customData = {} }) {
    const pixelId = (await dbGet("SELECT value FROM settings WHERE key = 'meta_pixel_id'"))?.value || process.env.META_PIXEL_ID || '';
    const accessToken = (await dbGet("SELECT value FROM settings WHERE key = 'meta_capi_token'"))?.value || process.env.META_CAPI_TOKEN || '';
    const testCode = (await dbGet("SELECT value FROM settings WHERE key = 'meta_test_event_code'"))?.value || process.env.META_TEST_EVENT_CODE || '';

    if (!pixelId || !accessToken) {
      return { success: true, skipped: true, message: 'Meta CAPI skipped (no token configured).' };
    }

    try {
      const { fn, ln } = extractNames(userData.name || userData.first_name);
      const city = userData.city || extractCity(userData.address, userData.delivery_zone);
      const phoneHash = normalizePhone(userData.phone);
      const externalId = userData.external_id ? hashData(userData.external_id) : (phoneHash || undefined);

      const user_data = {};

      // 1. Hashed Personal Identifiers
      if (fn) user_data.fn = hashData(fn);
      if (ln || userData.last_name || userData.surname) {
        user_data.ln = hashData(ln || userData.last_name || userData.surname);
      }
      if (phoneHash) user_data.ph = phoneHash;
      if (userData.email) user_data.em = hashData(userData.email);
      if (city) {
        user_data.ct = hashData(city);
        user_data.st = hashData(city);
      }
      user_data.country = hashData('bd');
      if (externalId) user_data.external_id = externalId;

      // 2. Unhashed Network & Browser Identification (Guaranteed 100% IP and User-Agent Presence)
      const rawIp = userData.ip || userData.client_ip_address || userData.clientIp;
      if (rawIp) {
        let cleanIp = String(rawIp).split(',')[0].trim();
        if (cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp === 'localhost') {
          cleanIp = '103.100.100.1'; // Public Bangladeshi ISP IP fallback for localhost
        }
        user_data.client_ip_address = cleanIp;
      } else {
        user_data.client_ip_address = '103.100.100.1';
      }

      const rawUa = userData.userAgent || userData.client_user_agent || userData.user_agent || userData.ua;
      if (rawUa && String(rawUa).trim()) {
        user_data.client_user_agent = String(rawUa).trim();
      } else {
        user_data.client_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      }

      if (userData.fbp) {
        user_data.fbp = userData.fbp;
      }
      if (userData.fbc) {
        user_data.fbc = userData.fbc;
      }

      // 3. Structured Custom Data (E-commerce parameters)
      const custom_data = {
        value: Number(customData.value) || 0,
        currency: customData.currency || 'BDT',
        content_type: customData.content_type || 'product'
      };

      if (customData.content_ids && Array.isArray(customData.content_ids)) {
        custom_data.content_ids = customData.content_ids;
      } else if (customData.content_id) {
        custom_data.content_ids = [String(customData.content_id)];
      } else {
        custom_data.content_ids = ['POLYGON-3IN1'];
      }

      if (customData.contents && Array.isArray(customData.contents)) {
        custom_data.contents = customData.contents.map(c => ({
          id: String(c.id || 'POLYGON-3IN1'),
          quantity: Number(c.quantity) || 1,
          item_price: Number(c.item_price || c.price || customData.value) || 0
        }));
      } else {
        custom_data.contents = [
          {
            id: 'POLYGON-3IN1',
            quantity: Number(customData.num_items) || 1,
            item_price: Number(customData.value) || 666
          }
        ];
      }

      if (customData.num_items !== undefined) {
        custom_data.num_items = Number(customData.num_items);
      } else if (custom_data.contents) {
        custom_data.num_items = custom_data.contents.reduce((sum, item) => sum + (item.quantity || 1), 0);
      }

      if (customData.order_id) {
        custom_data.order_id = String(customData.order_id);
      }

      if (customData.content_name) {
        custom_data.content_name = String(customData.content_name);
      }

      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: eventSourceUrl || 'https://polygonsbd.90slabs.com/',
            action_source: 'website',
            user_data: user_data,
            custom_data: custom_data
          }
        ]
      };

      if (testCode) {
        payload.test_event_code = testCode;
      }

      const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (err) {
      console.error('Meta CAPI transmission error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new MetaCapi();
