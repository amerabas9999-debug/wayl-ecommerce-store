# Wayl Ecommerce Store 🛍️

A full-featured, production-ready ecommerce platform with Wayl payment API integration, webhook support, and Render.com deployment configuration.

## Features ✨

- **Product Catalog** - Browse and manage products with images and descriptions
- **Shopping Cart** - Add/remove items with persistent storage
- **Wayl Payment Integration** - Create payment links with full API integration
- **Webhook Support** - Real-time order status updates via webhooks
- **Order Management** - Track orders and view detailed order history
- **Refund Processing** - Request refunds for completed orders
- **Admin Dashboard** - View all orders and webhook logs
- **Responsive Design** - Works on desktop and mobile devices
- **Production Ready** - Render.com deployment configuration included

## Quick Start 🚀

### Prerequisites
- Node.js 14+ installed
- Wayl merchant account and API token
- Render.com account (for deployment)

### Local Development

1. **Clone and Install**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wayl-ecommerce-store.git
   cd wayl-ecommerce-store
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Wayl API credentials:
   ```
   WAYL_API_TOKEN=your_merchant_token_here
   WAYL_ENV=test
   WEBHOOK_SECRET=your_secure_secret_here
   ```

3. **Start Server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Open in Browser**
   ```
   http://localhost:3000
   ```

## Deployment to Render 🌐

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Render**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure Environment Variables**
   In Render dashboard, add:
   - `WAYL_API_TOKEN` - Your Wayl merchant token
   - `WEBHOOK_SECRET` - Your webhook secret
   - `WAYL_ENV` - Set to `live` for production

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy

## API Endpoints 📡

### Products
```
GET  /api/products          - List all products
GET  /api/products/:id      - Get product details
```

### Orders & Checkout
```
POST /api/checkout          - Create payment link
GET  /api/orders/:ref       - Get order status
```

### Refunds
```
POST /api/refunds           - Request refund
```

### Webhooks
```
POST /webhooks/wayl         - Wayl webhook receiver
```

### Admin
```
GET  /api/admin/orders      - View all orders
GET  /api/admin/webhooks    - View webhook logs
GET  /health                - Health check
```

## Webhook Setup 🔗

Wayl will POST to `/webhooks/wayl` when order status changes. The webhook includes:

```json
{
  "event": "order.status.changed",
  "referenceId": "order_123",
  "paymentStatus": "Complete",
  "paymentMethod": "Card",
  "total": 10000,
  "code": "I94F590I"
}
```

**Signature Verification**: All webhooks are signed with `x-wayl-signature-256` header using HMAC-SHA256.

## Project Structure 📁

```
.
├── server.js              # Express server & API routes
├── public/
│   ├── index.html        # Main page
│   ├── styles.css        # Styling
│   └── app.js           # Frontend logic
├── package.json          # Dependencies
├── .env.example          # Environment template
├── render.yaml           # Render deployment config
└── README.md            # This file
```

## Environment Variables 🔐

| Variable | Required | Description |
|----------|----------|-------------|
| WAYL_API_TOKEN | Yes | Your Wayl merchant API token |
| WAYL_API_URL | No | Wayl API URL (default: https://api.thewayl.com) |
| WAYL_ENV | No | `test` or `live` (default: test) |
| PORT | No | Server port (default: 3000) |
| WEBHOOK_SECRET | Yes | Secret for webhook signature verification |
| WEBHOOK_URL | No | Your webhook URL for Wayl callbacks |
| REDIRECT_URL | No | URL to redirect after payment |

## Testing 🧪

### Local Testing
1. Set `WAYL_ENV=test` in `.env`
2. Request a test API token from Wayl: jisr@wayl.io
3. Use test payment methods in Wayl sandbox

### Webhook Testing
- Use [webhook.site](https://webhook.site) for local webhook testing
- Update `WEBHOOK_URL` in `.env` with your webhook.site URL
- View incoming webhooks in real-time

## Security 🔒

- API tokens stored in environment variables only
- Webhook signatures verified using HMAC-SHA256
- Sensitive data never exposed in client-side code
- HTTPS required for production webhook URLs
- CORS configured for specified domains

## Troubleshooting 🐛

### "Invalid authentication key"
- Check `WAYL_API_TOKEN` in `.env`
- Verify token format and expiration
- Contact Wayl: jisr@wayl.io

### Webhooks not received
- Ensure `WEBHOOK_URL` is publicly accessible
- Check server logs: `npm start`
- Use webhook.site to verify incoming requests
- Verify `WEBHOOK_SECRET` matches

### Payment link creation fails
- Verify all required fields are present
- Check that `total` matches line item sum
- Ensure `referenceId` is unique

## Support 💬

- **Wayl Documentation**: https://docs.thewayl.com
- **Wayl Support**: jisr@wayl.io
- **Issues**: Open an issue on GitHub

## License 📄

MIT License - feel free to use this project as a starting point for your ecommerce store!

## Getting Help 🤝

1. Check the [Wayl API Reference](https://api.thewayl.com)
2. Review environment variables in `.env.example`
3. Check server logs for errors
4. Contact Wayl support for API issues

---

**Built with ❤️ for Wayl merchants**
