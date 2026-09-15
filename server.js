require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static('public'));

// Store data (in production, use a database)
const orders = new Map();
const products = new Map();
const webhookLogs = [];

// Initialize demo products for MBOOSTT
function initializeProducts() {
  const demoProducts = [
    {
      id: 'prod_001',
      title: 'MANIFEST WEALTH',
      price: '$49',
      description: 'Digital masterpiece to unlock your potential',
      link: 'https://mboostt.io/secure/ebook-manifest',
      image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"%3E%3Crect width="240" height="240" fill="%232e140e"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Georgia" font-size="20" fill="%23e6c39a"%3E📖 LUXE EBOOK%3C/text%3E%3C/svg%3E'
    },
    {
      id: 'prod_002',
      title: 'MINDSET AUDIO',
      price: '$89',
      description: 'Premium audio course for elite mindset',
      link: 'https://mboostt.io/secure/audio-mindset',
      image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"%3E%3Crect width="240" height="240" fill="%232b0f0f"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="18" fill="%23d9b48f"%3E🎧 AUDIO%3C/text%3E%3C/svg%3E'
    },
    {
      id: 'prod_003',
      title: 'ELITE TG BOT',
      price: '$129',
      description: 'Automated Telegram bot for success',
      link: 'https://t.me/elite_mboostt_bot',
      image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"%3E%3Crect width="240" height="240" fill="%23331212"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="22" fill="%23d9b48f"%3E🤖 BOT%3C/text%3E%3C/svg%3E'
    }
  ];

  demoProducts.forEach(p => {
    products.set(p.id, p);
  });
}

initializeProducts();

// Wayl API Helper
const wayl = {
  async createLink(orderData) {
    try {
      console.log('Creating Wayl payment link:', orderData);
      const response = await axios.post(`${process.env.WAYL_API_URL}/api/v1/links`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'X-WAYL-AUTHENTICATION': process.env.WAYL_API_TOKEN
        }
      });
      console.log('Wayl response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Wayl API Error:', error.response?.data || error.message);
      throw error;
    }
  },

  async getLink(referenceId) {
    try {
      const response = await axios.get(`${process.env.WAYL_API_URL}/api/v1/links/${referenceId}`, {
        headers: {
          'X-WAYL-AUTHENTICATION': process.env.WAYL_API_TOKEN
        }
      });
      return response.data;
    } catch (error) {
      console.error('Wayl API Error:', error.response?.data || error.message);
      throw error;
    }
  },

  async createRefund(refundData) {
    try {
      const response = await axios.post(`${process.env.WAYL_API_URL}/api/v1/refunds`, refundData, {
        headers: {
          'Content-Type': 'application/json',
          'X-WAYL-AUTHENTICATION': process.env.WAYL_API_TOKEN
        }
      });
      return response.data;
    } catch (error) {
      console.error('Wayl API Error:', error.response?.data || error.message);
      throw error;
    }
  },

  verifyWebhookSignature(data, signature, secret) {
    const calculatedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const calculatedSignatureBuffer = Buffer.from(calculatedSignature, 'hex');

    if (signatureBuffer.length !== calculatedSignatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, calculatedSignatureBuffer);
  }
};

// Routes

// Home - Serve MBOOSTT.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mboostt.html'));
});

// Get all products
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    data: Array.from(products.values())
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// Create payment link for MBOOSTT product
app.post('/api/checkout', express.json(), async (req, res) => {
  try {
    const { productId, customer } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }

    const product = products.get(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Convert price string to number (e.g., "$49" -> 49000)
    const priceMatch = product.price.match(/\d+/);
    const priceInIQD = parseInt(priceMatch[0]) * 1000; // Convert to IQD

    const referenceId = `mboostt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const lineItems = [
      {
        label: product.title,
        amount: priceInIQD,
        type: 'increase'
      }
    ];

    const waylPayload = {
      env: process.env.WAYL_ENV || 'live',
      referenceId: referenceId,
      total: priceInIQD,
      currency: 'IQD',
      customParameter: customer?.email || 'mboostt-customer',
      lineItem: lineItems,
      webhookUrl: process.env.WEBHOOK_URL || `${req.get('origin')}/webhooks/wayl`,
      webhookSecret: process.env.WEBHOOK_SECRET,
      redirectionUrl: process.env.REDIRECT_URL || `${req.get('origin')}/success?ref=${referenceId}`
    };

    const waylResponse = await wayl.createLink(waylPayload);

    // Store order
    orders.set(referenceId, {
      referenceId,
      productId,
      product,
      customer,
      total: priceInIQD,
      status: 'Created',
      createdAt: new Date(),
      waylData: waylResponse.data
    });

    res.json({
      success: true,
      data: {
        referenceId,
        checkoutUrl: waylResponse.data.url,
        code: waylResponse.data.code
      },
      message: 'Payment link created successfully'
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment link'
    });
  }
});

// Get order status
app.get('/api/orders/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const order = orders.get(referenceId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get latest status from Wayl
    const waylStatus = await wayl.getLink(referenceId);

    // Update local order
    order.status = waylStatus.data.status;
    order.paymentMethod = waylStatus.data.paymentMethod;
    order.completedAt = waylStatus.data.completedAt;
    order.waylData = waylStatus.data;

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order status'
    });
  }
});

// Webhook endpoint - Handle raw body
app.post('/webhooks/wayl', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['x-wayl-signature-256'];
    const rawBody = req.body;
    const secret = process.env.WEBHOOK_SECRET;

    console.log('Webhook received');
    console.log('Signature:', signature);
    console.log('Raw body type:', typeof rawBody);

    // Verify signature
    if (!wayl.verifyWebhookSignature(rawBody, signature, secret)) {
      console.warn('Invalid webhook signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const data = JSON.parse(rawBody);
    const { referenceId, event, paymentStatus } = data;

    console.log(`Webhook processed: ${event} for order ${referenceId}`);

    // Update order status
    if (orders.has(referenceId)) {
      const order = orders.get(referenceId);
      order.status = paymentStatus;
      order.lastWebhookEvent = event;
      order.lastWebhookAt = new Date();
      order.webhookData = data;
    }

    // Log webhook
    webhookLogs.push({
      timestamp: new Date(),
      referenceId,
      event,
      paymentStatus,
      data
    });

    // Keep only last 100 logs
    if (webhookLogs.length > 100) {
      webhookLogs.shift();
    }

    // Respond with 2xx
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ success: true, message: 'Error processed' });
  }
});

// Request refund
app.post('/api/refunds', express.json(), async (req, res) => {
  try {
    const { referenceId, amount, reason } = req.body;

    if (!referenceId || !amount || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (reason.length < 100) {
      return res.status(400).json({ success: false, message: 'Reason must be at least 100 characters' });
    }

    const refundData = {
      referenceId,
      amount,
      reason
    };

    const waylResponse = await wayl.createRefund(refundData);

    res.json({
      success: true,
      data: waylResponse.data,
      message: 'Refund request submitted'
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create refund'
    });
  }
});

// Admin: View all orders
app.get('/api/admin/orders', (req, res) => {
  const ordersList = Array.from(orders.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json({
    success: true,
    data: ordersList,
    total: ordersList.length
  });
});

// Admin: View webhook logs
app.get('/api/admin/webhooks', (req, res) => {
  res.json({
    success: true,
    data: webhookLogs,
    total: webhookLogs.length
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 MBOOSTT Luxury Store running on port ${PORT}`);
  console.log(`💎 Store URL: http://localhost:${PORT}`);
  console.log(`💳 Wayl API: ${process.env.WAYL_API_URL}`);
  console.log(`🔐 API Token: ${process.env.WAYL_API_TOKEN ? '✓ Configured' : '✗ Missing'}\n`);
});