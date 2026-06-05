function openAdminPanel() {
    if (!currentUser?.is_admin) { showNotification('Доступ запрещён', 'error'); return; }
    document.getElementById('adminPanel')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
    loadAdminStats();
    loadAdminBookings();
    loadAdminProducts();
    loadAdminUsers();
    loadAdminReviews();
}

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
            const s = await res.json();
            document.getElementById('statTotalUsers').textContent = s.total_users;
            document.getElementById('statTotalBookings').textContent = s.total_bookings;
            document.getElementById('statActiveBookings').textContent = s.active_bookings;
            document.getElementById('statTotalRevenue').textContent = s.total_revenue.toLocaleString() + ' ₽';
            if (document.getElementById('statTotalReviews')) {
                document.getElementById('statTotalReviews').textContent = s.total_reviews || 0;
            }
        }
    } catch(e) { console.error(e); }
}

async function loadAdminBookings() {
    try {
        const res = await fetch('/api/admin/bookings');
        if (res.ok) {
            const data = await res.json();
            const container = document.getElementById('adminBookingsList');
            if (!container) return;
            container.innerHTML = `
                <div style="overflow-x:auto">
                    <table style="width:100%; border-collapse:collapse">
                        <thead>
                            <tr><th>ID</th><th>Клиент</th><th>Товары</th><th>Даты</th><th>Сумма</th><th>Статус</th><th>Действия</th></tr>
                        </thead>
                        <tbody>
                            ${data.bookings.map(b => `
                                <tr>
                                    <td>#${b.id}</td>
                                    <td>${escapeHtml(b.user_name)}<br><small>${escapeHtml(b.user_email)}</small></td>
                                    <td>${b.items.map(i => i.name).join(', ')}</td>
                                    <td>${b.startDate} — ${b.endDate}</td>
                                    <td>${b.total.toLocaleString()} ₽</td>
                                    <td>
                                        <select onchange="updateBookingStatus(${b.id}, this.value)" style="margin-bottom:5px; width:100%">
                                            <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                                            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Активно</option>
                                            <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Завершено</option>
                                            <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменено</option>
                                        </select>
                                        <button class="delete-btn" onclick="deleteBooking(${b.id})" style="width:100%; margin-top:5px;">🗑️ Удалить</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

async function updateBookingStatus(id, status) {
    try {
        const res = await fetch(`/api/admin/bookings/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            showNotification('Статус обновлён');
            loadAdminBookings();
            loadAdminStats();
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

async function deleteBooking(id) {
    if (!confirm('Удалить это бронирование? Это действие нельзя отменить.')) return;
    try {
        const res = await fetch(`/api/admin/bookings/${id}/delete`, { method: 'DELETE' });
        if (res.ok) {
            showNotification('Бронирование удалено');
            loadAdminBookings();
            loadAdminStats();
        } else {
            showNotification('Ошибка удаления', 'error');
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

async function loadAdminProducts() {
    try {
        const res = await fetch('/api/admin/products');
        if (res.ok) {
            const data = await res.json();
            const container = document.getElementById('adminProductsList');
            if (!container) return;
            container.innerHTML = `
                <div class="add-product-form">
                    <h4>➕ Добавить новый товар</h4>
                    <div class="form-row">
                        <input type="text" id="newProductName" placeholder="Название товара">
                        <select id="newProductCategory">
                            <option value="cameras">Фотоаппараты</option>
                            <option value="lenses">Объективы</option>
                            <option value="video">Видеокамеры</option>
                            <option value="light">Свет</option>
                            <option value="audio">Звук</option>
                            <option value="stabilizers">Стабилизаторы</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <input type="number" id="newProductPrice" placeholder="Цена за день (₽)">
                        <input type="text" id="newProductImage" placeholder="URL фото">
                    </div>
                    <input type="text" id="newProductDesc" placeholder="Описание товара" style="width:100%; margin-bottom:0.5rem">
                    <button class="auth-submit" onclick="addNewProduct()" style="margin-top:0">➕ Добавить товар</button>
                </div>
                <h4>📦 Редактирование товаров</h4>
                <div style="overflow-x:auto">
                    <table style="width:100%; border-collapse:collapse">
                        <thead>
                            <tr><th>ID</th><th>Название</th><th>Категория</th><th>Цена</th><th>В наличии</th><th>Новинка</th><th>Действия</th></tr>
                        </thead>
                        <tbody>
                            ${data.products.map(p => `
                                <tr id="product-row-${p.id}">
                                    <td>${p.id}</td>
                                    <td><input type="text" id="name_${p.id}" value="${escapeHtml(p.name)}" style="width:150px"></td>
                                    <td>
                                        <select id="cat_${p.id}">
                                            <option value="cameras" ${p.category === 'cameras' ? 'selected' : ''}>Фотоаппараты</option>
                                            <option value="lenses" ${p.category === 'lenses' ? 'selected' : ''}>Объективы</option>
                                            <option value="video" ${p.category === 'video' ? 'selected' : ''}>Видеокамеры</option>
                                            <option value="light" ${p.category === 'light' ? 'selected' : ''}>Свет</option>
                                            <option value="audio" ${p.category === 'audio' ? 'selected' : ''}>Звук</option>
                                            <option value="stabilizers" ${p.category === 'stabilizers' ? 'selected' : ''}>Стабилизаторы</option>
                                        </select>
                                    </td>
                                    <td><input type="number" id="price_${p.id}" value="${p.price}" style="width:100px"></td>
                                    <td><input type="checkbox" id="stock_${p.id}" ${p.in_stock ? 'checked' : ''}></td>
                                    <td><input type="checkbox" id="new_${p.id}" ${p.is_new ? 'checked' : ''}></td>
                                    <td>
                                        <button class="edit-btn" onclick="saveProductFull(${p.id})">💾</button>
                                        <button class="delete-btn" onclick="deleteProduct(${p.id})">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

async function saveProductFull(id) {
    const name = document.getElementById(`name_${id}`).value;
    const category = document.getElementById(`cat_${id}`).value;
    const price = document.getElementById(`price_${id}`).value;
    const inStock = document.getElementById(`stock_${id}`).checked;
    const isNew = document.getElementById(`new_${id}`).checked;
    try {
        const res = await fetch(`/api/admin/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, price: parseInt(price), in_stock: inStock, is_new: isNew })
        });
        if (res.ok) {
            showNotification('Товар обновлён');
            if (typeof loadProducts === 'function') loadProducts();
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

async function addNewProduct() {
    const name = document.getElementById('newProductName')?.value;
    const category = document.getElementById('newProductCategory')?.value;
    const price = document.getElementById('newProductPrice')?.value;
    const image = document.getElementById('newProductImage')?.value || '';
    const description = document.getElementById('newProductDesc')?.value;
    if (!name || !price) return showNotification('Заполните название и цену', 'error');
    try {
        const res = await fetch('/api/admin/products/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, price: parseInt(price), image, description, is_new: false })
        });
        if (res.ok) {
            showNotification('Товар добавлен');
            loadAdminProducts();
            if (typeof loadProducts === 'function') loadProducts();
            document.getElementById('newProductName').value = '';
            document.getElementById('newProductPrice').value = '';
            document.getElementById('newProductImage').value = '';
            document.getElementById('newProductDesc').value = '';
        } else {
            showNotification('Ошибка добавления', 'error');
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

async function deleteProduct(id) {
    if (!confirm('Удалить этот товар?')) return;
    try {
        const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showNotification('Товар удалён');
            loadAdminProducts();
            if (typeof loadProducts === 'function') loadProducts();
        } else {
            showNotification('Ошибка удаления', 'error');
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
            const data = await res.json();
            const container = document.getElementById('adminUsersList');
            if (!container) return;
            container.innerHTML = `
                <div style="overflow-x:auto">
                    <table style="width:100%; border-collapse:collapse">
                        <thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Телефон</th><th>Админ</th></tr></thead>
                        <tbody>
                            ${data.users.map(u => `
                                <tr><td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${u.email}</td><td>${u.phone || '-'}</td><td>${u.is_admin ? '👑 Да' : 'Нет'}</td></tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

async function loadAdminReviews() {
    try {
        const res = await fetch('/api/admin/reviews');
        if (res.ok) {
            const data = await res.json();
            const container = document.getElementById('adminReviewsList');
            if (!container) return;
            if (data.reviews.length === 0) {
                container.innerHTML = '<p style="text-align:center; padding:2rem;">Нет отзывов</p>';
                return;
            }
            container.innerHTML = `
                <div style="overflow-x:auto">
                    <table style="width:100%; border-collapse:collapse">
                        <thead><tr><th>ID</th><th>Пользователь</th><th>Оценка</th><th>Отзыв</th><th>Дата</th><th>Действие</th></tr></thead>
                        <tbody>
                            ${data.reviews.map(r => `
                                <tr>
                                    <td>${r.id}</td>
                                    <td>${escapeHtml(r.user_name)}</td>
                                    <td>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td>
                                    <td style="max-width:300px">${escapeHtml(r.text)}</td>
                                    <td>${r.created_at}</td>
                                    <td><button class="delete-btn" onclick="deleteReviewAdmin(${r.id})">🗑️ Удалить</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

async function deleteReviewAdmin(id) {
    if (!confirm('Удалить этот отзыв?')) return;
    try {
        const res = await fetch(`/api/admin/reviews/${id}/delete`, { method: 'DELETE' });
        if (res.ok) {
            showNotification('Отзыв удалён');
            loadAdminReviews();
            if (typeof loadReviews === 'function') loadReviews();
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const contents = ['adminStatsContent', 'adminBookingsContent', 'adminProductsContent', 'adminUsersContent', 'adminReviewsContent'];
    contents.forEach(c => {
        const el = document.getElementById(c);
        if (el) el.style.display = 'none';
    });
    if (tab === 'stats') {
        document.querySelector('.admin-tab:first-child')?.classList.add('active');
        document.getElementById('adminStatsContent').style.display = 'block';
    } else if (tab === 'bookings') {
        document.querySelector('.admin-tab:nth-child(2)')?.classList.add('active');
        document.getElementById('adminBookingsContent').style.display = 'block';
        loadAdminBookings();
    } else if (tab === 'products') {
        document.querySelector('.admin-tab:nth-child(3)')?.classList.add('active');
        document.getElementById('adminProductsContent').style.display = 'block';
        loadAdminProducts();
    } else if (tab === 'users') {
        document.querySelector('.admin-tab:nth-child(4)')?.classList.add('active');
        document.getElementById('adminUsersContent').style.display = 'block';
        loadAdminUsers();
    } else if (tab === 'reviews') {
        document.querySelector('.admin-tab:nth-child(5)')?.classList.add('active');
        document.getElementById('adminReviewsContent').style.display = 'block';
        loadAdminReviews();
    }
}

function closeAdminPanel() {
    document.getElementById('adminPanel')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}