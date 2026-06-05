let cart = [];

function loadCart() {
    const saved = localStorage.getItem('cart');
    cart = saved ? JSON.parse(saved) : [];
    updateCartDisplay();
}

function updateCartCount() {
    const count = document.getElementById('cartCount');
    if (count) count.textContent = cart.length;
}

function updateCartDisplay() {
    const container = document.getElementById('cartItems');
    const totalSpan = document.getElementById('cartTotal');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem;">🛒 Корзина пуста</p>';
        if (totalSpan) totalSpan.textContent = '0 ₽';
        const btn = document.getElementById('checkoutBtn');
        if (btn) btn.disabled = true;
        return;
    }
    let total = 0;
    container.innerHTML = '';
    cart.forEach(item => {
        total += item.price;
        container.innerHTML += `
            <div class="cart-item">
                <div><strong>${escapeHtml(item.name)}</strong><br>${item.price.toLocaleString()} ₽/день</div>
                <button onclick="removeFromCart(${item.id})" style="background:none; border:none; color: var(--primary); font-size:1.2rem; cursor:pointer">✕</button>
            </div>
        `;
    });
    if (totalSpan) totalSpan.textContent = `${total.toLocaleString()} ₽`;
    const btn = document.getElementById('checkoutBtn');
    if (btn) btn.disabled = false;
}

function addToCart(productId) {
    if (!currentUser) { openAuthModal(); return showNotification('Войдите, чтобы добавить товар', 'info'); }
    const product = products.find(p => p.id === productId);
    if (!product || !product.in_stock) return showNotification('Товар недоступен', 'error');
    cart.push({ id: Date.now(), productId: product.id, name: product.name, price: product.price });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
    showNotification(`✅ ${product.name} добавлен в корзину`);
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.id !== cartId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    updateCartDisplay();
    showNotification('Товар удалён');
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    } else {
        loadCart();
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
}

function openBookingModal() {
    if (cart.length === 0) return showNotification('Корзина пуста', 'error');
    if (!currentUser) { openAuthModal(); return showNotification('Войдите, чтобы оформить аренду', 'info'); }
    document.getElementById('bookingModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = tomorrow;
    updateBookingItems();
    calculateTotal();
}

function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function updateBookingItems() {
    const container = document.getElementById('bookingItems');
    if (!container) return;
    container.innerHTML = '<h4 style="margin-bottom:1rem">📦 Ваши товары</h4>';
    cart.forEach(item => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:0.8rem; border-bottom:1px solid var(--border)">
                <span>${escapeHtml(item.name)}</span>
                <span>${item.price.toLocaleString()} ₽/день</span>
            </div>
        `;
    });
}

function calculateTotal() {
    const start = document.getElementById('startDate')?.value;
    const end = document.getElementById('endDate')?.value;
    if (!start || !end) return;
    const days = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000));
    const subtotal = cart.reduce((s, i) => s + i.price, 0) * days;
    const insurance = Math.round(subtotal * 0.1);
    const total = subtotal + insurance;
    document.getElementById('totalAmount').textContent = `${total.toLocaleString()} ₽`;
}

async function confirmBooking() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const days = Math.ceil((new Date(end) - new Date(start)) / 86400000);
    if (days < 1) return showNotification('Дата окончания должна быть позже', 'error');
    const total = parseInt(document.getElementById('totalAmount').textContent.replace(/\D/g, ''));
    const data = {
        items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price })),
        startDate: start,
        endDate: end,
        days: days,
        total: total,
        paymentMethod: 'card',
        deliveryMethod: 'pickup',
        deliveryAddress: ''
    };
    try {
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            closeBookingModal();
            showNotification('🎉 Бронирование оформлено!');
            if (typeof loadUserBookings === 'function') loadUserBookings();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Ошибка', 'error');
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}