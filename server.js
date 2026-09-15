require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Static files
app.use(express.static('public'));

// Store data (in production, use a database)
const orders = new Map();
const products = new Map();
const webhookLogs = [];

// Initialize sample products
function initializeProducts() {
  products.set('prod_001', {
    id: 'prod_001',
    name: 'Premium Headphones',
    price: 50000,
    description: 'High-quality wireless headphones',
    image: 'https://via.placeholder.com/300x300?text=Headphones'
  });
  products.set('prod_002', {
    id: 'prod_002',
    name: 'USB-C Cable',
    price: 15000,
    description: 'Durable USB-C charging cable',
    image: 'https://via.placeholder.com/300x300?text=USB-C+Cable'
  });
  products.set('prod_003', {
    id: 'prod_003',
    name: 'Phone Case',
    price: 25000,
    description: 'Protective phone case with premium materials',
    image: 'https://via.placeholder.com/300x300?text=Phone+Case'
  });
  products.set('prod_004', {
    id: 'prod_004',
    name: 'Screen Protector',
    price: 10000,
    description: 'Tempered glass screen protector',
    image: 'https://via.placeholder.com/300x300?text=Screen+Protector'
  });
}

initializeProducts();

// Wayl API Helper
const wayl = {
  async createLink(orderData) {
    try {
      const response = await axios.post(`${process.env.WAYL_API_URL}/api/v1/links`, orderData, {
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

// Home
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
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

// Create payment link
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in cart' });
    }

    // Calculate total
    let total = 0;
    const lineItems = items.map(item => {
      const product = products.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const amount = product.price * item.quantity;
      total += amount;
      return {
        label: `${product.name} x${item.quantity}`,
        amount: amount,
        type: 'increase'
      };
    });

    const referenceId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const waylPayload = {
      env: process.env.WAYL_ENV || 'test',
      referenceId: referenceId,
      total: total,
      currency: 'IQD',
      customParameter: customer?.email || '',
      lineItem: lineItems,
      webhookUrl: process.env.WEBHOOK_URL || `${req.get('origin')}/webhooks/wayl`,
      webhookSecret: process.env.WEBHOOK_SECRET,
      redirectionUrl: process.env.REDIRECT_URL || `${req.get('origin')}/success?ref=${referenceId}`
    };

    const waylResponse = await wayl.createLink(waylPayload);

    // Store order
    orders.set(referenceId, {
      referenceId,
      items,
      customer,
      total,
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

// Webhook endpoint
app.post('/webhooks/wayl', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['x-wayl-signature-256'];
    const rawBody = req.body;
    const secret = process.env.WEBHOOK_SECRET;

    // Verify signature
    if (!wayl.verifyWebhookSignature(rawBody, signature, secret)) {
      console.warn('Invalid webhook signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const data = JSON.parse(rawBody);
    const { referenceId, event, paymentStatus } = data;

    console.log(`Webhook received: ${event} for order ${referenceId}`);

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
app.post('/api/refunds', async (req, res) => {
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Store URL: http://localhost:${PORT}`);
  console.log(`🔐 API Token: ${process.env.WAYL_API_TOKEN ? '✓ Configured' : '✗ Missing'}`);
});
