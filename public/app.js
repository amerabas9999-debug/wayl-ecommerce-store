// State
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let userOrders = JSON.parse(localStorage.getItem('orders')) || [];
let allProducts = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();
    loadOrders();
});

// Load products from API
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const result = await response.json();
        allProducts = result.data;
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsGrid').innerHTML =
            '<p style="color: red;">Error loading products</p>';
    }
}

// Render products
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = allProducts.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-description">${product.description}</div>
                <div class="product-price">${product.price.toLocaleString()} IQD</div>
                <div class="product-actions">
                    <input type="number" class="qty-input" id="qty-${product.id}" value="1" min="1" max="10">
                    <button class="btn-add" onclick="addToCart('${product.id}')">Add to Cart</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Add to cart
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    const quantity = parseInt(document.getElementById(`qty-${productId}`).value);

    if (quantity < 1) {
        alert('Invalid quantity');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            productId,
            name: product.name,
            price: product.price,
            quantity
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    alert(`${product.name} added to cart!`);
    document.getElementById(`qty-${productId}`).value = 1;
}

// Update cart UI
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛒</div><p>Your cart is empty</p></div>';
        cartTotal.textContent = '0 IQD';
        document.getElementById('checkoutBtn').disabled = true;
        return;
    }

    let total = 0;
    cartItems.innerHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price.toLocaleString()} IQD each</div>
                </div>
                <div class="cart-item-qty">x${item.quantity}</div>
                <div style="font-weight: 600;">${itemTotal.toLocaleString()} IQD</div>
                <button class="btn-remove" onclick="removeFromCart(${index})">Remove</button>
            </div>
        `;
    }).join('');

    cartTotal.textContent = total.toLocaleString() + ' IQD';
    document.getElementById('checkoutBtn').disabled = false;
}

// Remove from cart
function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

// Checkout
async function checkout() {
    if (cart.length === 0) {
        alert('Cart is empty');
        return;
    }

    // Collect customer info
    const customerName = prompt('Enter your name:');
    if (!customerName) return;

    const customerEmail = prompt('Enter your email:');
    if (!customerEmail) return;

    const customerPhone = prompt('Enter your phone number:');
    if (!customerPhone) return;

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: cart,
                customer: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone
                }
            })
        });

        const result = await response.json();

        if (!result.success) {
            alert('Error: ' + result.message);
            return;
        }

        const { referenceId, checkoutUrl } = result.data;

        // Save order to local storage
        userOrders.push({
            referenceId,
            items: [...cart],
            customer: { name: customerName, email: customerEmail, phone: customerPhone },
            status: 'Created',
            createdAt: new Date().toISOString(),
            checkoutUrl
        });
        localStorage.setItem('orders', JSON.stringify(userOrders));

        // Clear cart and redirect
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();

        // Redirect to checkout
        window.location.href = checkoutUrl;
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Error processing checkout');
    }
}

// Load user orders
async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl = urlParams.get('ref');

    if (refFromUrl && !userOrders.find(o => o.referenceId === refFromUrl)) {
        await fetchOrderStatus(refFromUrl);
    }

    renderOrders();
}

// Fetch order status from server
async function fetchOrderStatus(referenceId) {
    try {
        const response = await fetch(`/api/orders/${referenceId}`);
        const result = await response.json();

        if (result.success) {
            const order = userOrders.find(o => o.referenceId === referenceId);
            if (order) {
                order.status = result.data.status;
                order.paymentMethod = result.data.paymentMethod;
                order.completedAt = result.data.completedAt;
            } else {
                userOrders.push({
                    referenceId,
                    items: [],
                    customer: {},
                    status: result.data.status,
                    paymentMethod: result.data.paymentMethod,
                    completedAt: result.data.completedAt,
                    createdAt: result.data.createdAt,
                    waylData: result.data
                });
            }
            localStorage.setItem('orders', JSON.stringify(userOrders));
        }
    } catch (error) {
        console.error('Error fetching order status:', error);
    }
}

// Render orders
function renderOrders() {
    const ordersList = document.getElementById('ordersList');

    if (userOrders.length === 0) {
        ordersList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>No orders yet</p></div>';
        return;
    }

    ordersList.innerHTML = userOrders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `
                <div class="order-card" onclick="showOrderDetails('${order.referenceId}')">
                    <div class="order-header">
                        <div class="order-ref">${order.referenceId}</div>
                        <div class="order-status status-${order.status.toLowerCase()}">${order.status}</div>
                    </div>
                    <div class="order-info">
                        <div>📅 ${date}</div>
                        <div>${order.customer?.name || 'Guest'}</div>
                        <div>💰 ${order.items?.reduce((sum, i) => sum + (i.price * i.quantity), 0)?.toLocaleString() || 0} IQD</div>
                    </div>
                </div>
            `;
        }).join('');
}

// Show order details
function showOrderDetails(referenceId) {
    const order = userOrders.find(o => o.referenceId === referenceId);
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const details = document.getElementById('orderDetails');

    const itemsHtml = order.items?.map(item => `
        <div style="padding: 10px; background: #f9f9f9; border-radius: 5px; margin-bottom: 10px;">
            <div><strong>${item.name}</strong> x${item.quantity}</div>
            <div>${(item.price * item.quantity).toLocaleString()} IQD</div>
        </div>
    `).join('') || '<p>No items</p>';

    const refundBtn = order.status === 'Complete' || order.status === 'Delivered' ? `
        <button class="btn-primary" onclick="requestRefund('${referenceId}')">Request Refund</button>
    ` : '';

    details.innerHTML = `
        <div class="modal-section">
            <div class="modal-label">Reference ID</div>
            <div class="modal-value">${order.referenceId}</div>
        </div>
        <div class="modal-section">
            <div class="modal-label">Status</div>
            <div class="modal-value order-status status-${order.status.toLowerCase()}" style="display: inline-block;">${order.status}</div>
        </div>
        <div class="modal-section">
            <div class="modal-label">Customer</div>
            <div class="modal-value">${order.customer?.name || 'N/A'}</div>
            <div class="modal-value">${order.customer?.email || 'N/A'}</div>
            <div class="modal-value">${order.customer?.phone || 'N/A'}</div>
        </div>
        <div class="modal-section">
            <div class="modal-label">Items</div>
            ${itemsHtml}
        </div>
        <div class="modal-section">
            <div class="modal-label">Date</div>
            <div class="modal-value">${new Date(order.createdAt).toLocaleString()}</div>
        </div>
        ${order.paymentMethod ? `<div class="modal-section"><div class="modal-label">Payment Method</div><div class="modal-value">${order.paymentMethod}</div></div>` : ''}
        ${order.completedAt ? `<div class="modal-section"><div class="modal-label">Completed At</div><div class="modal-value">${new Date(order.completedAt).toLocaleString()}</div></div>` : ''}
        <div style="margin-top: 20px;">
            ${refundBtn}
            <button class="btn-primary" onclick="refreshOrderStatus('${referenceId}')">Refresh Status</button>
        </div>
    `;

    modal.classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('orderModal').classList.remove('show');
}

// Refresh order status
async function refreshOrderStatus(referenceId) {
    await fetchOrderStatus(referenceId);
    renderOrders();
    showOrderDetails(referenceId);
}

// Request refund
function requestRefund(referenceId) {
    const order = userOrders.find(o => o.referenceId === referenceId);
    const total = order.items?.reduce((sum, i) => sum + (i.price * i.quantity), 0) || 0;

    const amount = prompt(`Enter refund amount (Max: ${total} IQD):`);
    if (!amount || isNaN(amount) || amount <= 0 || amount > total) {
        alert('Invalid amount');
        return;
    }

    const reason = prompt('Enter refund reason (minimum 100 characters):');
    if (!reason || reason.length < 100) {
        alert('Reason must be at least 100 characters');
        return;
    }

    processRefund(referenceId, parseInt(amount), reason);
}

// Process refund
async function processRefund(referenceId, amount, reason) {
    try {
        const response = await fetch('/api/refunds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                referenceId,
                amount,
                reason
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Refund request submitted successfully!\nStatus: ' + result.data.status);
            refreshOrderStatus(referenceId);
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Refund error:', error);
        alert('Error processing refund');
    }
}

// Show/Hide sections
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('orderModal');
    if (event.target === modal) {
        modal.classList.remove('show');
    }
};
