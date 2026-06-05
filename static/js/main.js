let products = [];
let filteredProducts = [];
let currentPage = 1;
const perPage = 12;

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadReviews();
    checkAuth();
    loadCart();
    updateCartCount();
    loadTheme();
});

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        products = data.products;
        filteredProducts = [...products];
        displayProducts();
    } catch(e) {
        console.error('Ошибка загрузки товаров:', e);
        showNotification('Ошибка загрузки товаров', 'error');
    }
}

function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const end = currentPage * perPage;
    const toShow = filteredProducts.slice(0, end);

    if (currentPage === 1) grid.innerHTML = '';

    toShow.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Используем изображение если есть, иначе эмодзи
        const imageHtml = p.image && p.image !== '' ? 
            `<img src="${p.image}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover">` : 
            `<div class="emoji-placeholder" style="font-size: 4rem;">${getCategoryEmoji(p.category)}</div>`;
        
        card.innerHTML = `
            ${p.is_new ? '<div class="product-badge">🔥 NEW</div>' : ''}
            <div class="product-image">
                ${imageHtml}
            </div>
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(p.name)}</h3>
                <div class="product-price">${p.price.toLocaleString()} ₽/день</div>
                <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 1rem;">${escapeHtml(p.description || 'Профессиональное оборудование')}</p>
                <button class="rent-btn" onclick="addToCart(${p.id})" ${!p.in_stock ? 'disabled' : ''}>
                    ${p.in_stock ? '📷 Арендовать' : '❌ Нет в наличии'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.style.display = end >= filteredProducts.length ? 'none' : 'block';
}

function getCategoryEmoji(category) {
    const emojis = { 'cameras': '📷', 'lenses': '🔍', 'video': '🎥', 'light': '💡', 'audio': '🎤', 'stabilizers': '⚖️' };
    return emojis[category] || '📸';
}

function filterByCategory(cat) {
    filteredProducts = cat === 'all' ? [...products] : products.filter(p => p.category === cat);
    currentPage = 1;
    displayProducts();
}

function searchProducts() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
    filteredProducts = term ? products.filter(p => p.name.toLowerCase().includes(term)) : [...products];
    currentPage = 1;
    displayProducts();
}

function sortProducts() {
    const type = document.getElementById('sortSelect')?.value || 'popular';
    if (type === 'price-asc') filteredProducts.sort((a,b) => a.price - b.price);
    else if (type === 'price-desc') filteredProducts.sort((a,b) => b.price - a.price);
    else filteredProducts.sort((a,b) => (b.popularity || 0) - (a.popularity || 0));
    displayProducts();
}

function loadMoreProducts() {
    currentPage++;
    displayProducts();
}

function showCatalog() {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
}

async function loadReviews() {
    try {
        const res = await fetch('/api/reviews');
        const data = await res.json();
        const slider = document.getElementById('reviewsSlider');
        if (!slider) return;
        if (data.reviews.length === 0) {
            slider.innerHTML = '<p style="text-align:center; padding:2rem;">Пока нет отзывов. Будьте первым!</p>';
            return;
        }
        slider.innerHTML = data.reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-avatar">${escapeHtml(r.user_name.charAt(0))}</div>
                    <div>
                        <h4>${escapeHtml(r.user_name)}</h4>
                        <div class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                    </div>
                </div>
                <p class="review-text">"${escapeHtml(r.text)}"</p>
                <div class="review-date">${r.created_at}</div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openReviewModal() {
    if (!currentUser) { openAuthModal(); return showNotification('Войдите, чтобы оставить отзыв', 'info'); }
    document.getElementById('reviewModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    document.getElementById('reviewText').value = '';
    setRating(5);
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function setRating(rating) {
    window.selectedRating = rating;
    const stars = document.querySelectorAll('.star-rating i');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.style.color = '#fbbf24';
        } else {
            star.classList.remove('active');
            star.style.color = '#cbd5e1';
        }
    });
}

async function submitReview() {
    const text = document.getElementById('reviewText').value;
    const rating = window.selectedRating || 5;
    if (!text || text.trim().length < 10) return showNotification('Напишите отзыв (минимум 10 символов)', 'error');
    try {
        const res = await fetch('/api/reviews/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim(), rating })
        });
        if (res.ok) {
            showNotification('Спасибо за отзыв!');
            closeReviewModal();
            loadReviews();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Ошибка', 'error');
        }
    } catch(e) { showNotification('Ошибка отправки', 'error'); }
}

function toggleMobileMenu() {
    document.getElementById('navMenu')?.classList.toggle('active');
}

function closeAllModals() {
    document.getElementById('cartSidebar')?.classList.remove('active');
    document.getElementById('authModal')?.classList.remove('active');
    document.getElementById('bookingModal')?.classList.remove('active');
    document.getElementById('profileSection')?.classList.remove('active');
    document.getElementById('adminPanel')?.classList.remove('active');
    document.getElementById('reviewModal')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
}

function showNotification(msg, type = 'success') {
    const n = document.getElementById('notification');
    if (!n) return;
    n.textContent = msg;
    n.style.background = type === 'error' ? '#ef4444' : 'var(--gradient)';
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3000);
}

function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

window.selectedRating = 5;