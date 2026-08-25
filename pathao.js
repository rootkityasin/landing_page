const { dbGet } = require('./database');

class PathaoClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getCredentials() {
    const baseUrl = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_base_url'"))?.value || 'https://courier-api-sandbox.pathao.com';
    const clientId = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_client_id'"))?.value || '';
    const clientSecret = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_client_secret'"))?.value || '';
    const username = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_username'"))?.value || '';
    const password = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_password'"))?.value || '';
    const storeId = (await dbGet("SELECT value FROM settings WHERE key = 'pathao_store_id'"))?.value || '';

    return { baseUrl, clientId, clientSecret, username, password, storeId };
  }

  async getValidToken(creds) {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!creds.clientId || !creds.clientSecret || !creds.username || !creds.password) {
      return null;
    }

    try {
      const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/issue-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          username: creds.username,
          password: creds.password,
          grant_type: 'password'
        })
      });

      const data = await response.json();
      if (response.ok && data.access_token) {
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
        return this.accessToken;
      } else {
        console.error('Pathao auth error:', data);
        return null;
      }
    } catch (err) {
      console.error('Failed to issue Pathao token:', err.message);
      return null;
    }
  }

  async createConsignment(order) {
    const creds = await this.getCredentials();

    // Check if live credentials configured
    const token = await this.getValidToken(creds);

    if (!token || !creds.storeId) {
      // Return simulated sandbox fulfillment if credentials are not configured yet
      const simulatedConsignmentId = `PT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const simulatedTrackingCode = `TRK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      return {
        success: true,
        simulated: true,
        consignment_id: simulatedConsignmentId,
        tracking_code: simulatedTrackingCode,
        message: 'Order dispatched in Sandbox Mode (Add live Pathao credentials in Admin Settings for production).'
      };
    }

    try {
      const payload = {
        store_id: parseInt(creds.storeId, 10),
        merchant_order_id: order.order_number,
        recipient_name: order.customer_name,
        recipient_phone: order.phone,
        recipient_address: order.address,
        recipient_city: order.delivery_zone === 'dhaka_inside' ? 1 : 2,
        recipient_zone: 1,
        delivery_type: 48,
        item_type: 2,
        special_instruction: 'Please deliver safely and collect Cash on Delivery.',
        item_quantity: order.quantity || 1,
        item_weight: 0.5,
        amount_to_collect: Math.round(order.total_amount),
        item_description: `${order.product_name || 'Product'} (${order.bundle_name || 'Set'})`
      };

      const response = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (response.ok && resData.data) {
        return {
          success: true,
          consignment_id: resData.data.consignment_id,
          tracking_code: resData.data.delivery_fee?.tracking_code || resData.data.consignment_id,
          data: resData.data
        };
      } else {
        return {
          success: false,
          error: resData.message || 'Failed to create Pathao order',
          details: resData
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = new PathaoClient();
