const crypto = require('crypto');
const { dbGet } = require('./database');

function hashData(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '88' + clean;
  }
  return hashData(clean);
}

class MetaCapi {
  async sendEvent({ eventName, eventId, eventSourceUrl, userData = {}, customData = {} }) {
    const pixelId = (await dbGet("SELECT value FROM settings WHERE key = 'meta_pixel_id'"))?.value || process.env.META_PIXEL_ID || '';
    const accessToken = (await dbGet("SELECT value FROM settings WHERE key = 'meta_capi_token'"))?.value || process.env.META_CAPI_TOKEN || '';
    const testCode = (await dbGet("SELECT value FROM settings WHERE key = 'meta_test_event_code'"))?.value || process.env.META_TEST_EVENT_CODE || '';

    if (!pixelId || !accessToken) {
      // Return silent success if Meta CAPI is not configured yet
      return { success: true, skipped: true, message: 'Meta CAPI skipped (no token configured).' };
    }

    try {
      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: eventSourceUrl,
            action_source: 'website',
            user_data: {
              fn: hashData(userData.name),
              ph: normalizePhone(userData.phone),
              client_ip_address: userData.ip,
              client_user_agent: userData.userAgent
            },
            custom_data: customData
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
