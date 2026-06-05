let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            currentUser = await res.json();
            updateUIForAuth();
        }
    } catch(e) { console.log('Не авторизован'); }
}

function updateUIForAuth() {
    const authLink = document.getElementById('authLink');
    if (authLink) {
        authLink.innerHTML = '👤 Личный кабинет';
        authLink.onclick = (e) => { e.preventDefault(); openProfile(); };
    }
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    if (userName) userName.textContent = currentUser.name;
    if (userEmail) userEmail.textContent = currentUser.email;
    if (profileAvatar) profileAvatar.textContent = currentUser.name.charAt(0);

    if (currentUser.is_admin && !document.getElementById('adminNavLink')) {
        const nav = document.getElementById('navMenu');
        const link = document.createElement('a');
        link.id = 'adminNavLink';
        link.href = '#';
        link.innerHTML = '🛡️ Админ-панель';
        link.onclick = (e) => { e.preventDefault(); openAdminPanel(); };
        const cartBtn = nav.querySelector('.cart-btn');
        if (cartBtn) nav.insertBefore(link, cartBtn);
        else nav.appendChild(link);
    }
}

function openAuthModal() {
    document.getElementById('authModal')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
        document.querySelector('.auth-tab:first-child').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelector('.auth-tab:last-child').classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

async function login() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) return showNotification('Заполните все поля', 'error');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (res.ok) {
            currentUser = await res.json();
            updateUIForAuth();
            closeAllModals();
            showNotification('Добро пожаловать!');
            location.reload();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Ошибка входа', 'error');
        }
    } catch(e) { showNotification('Ошибка соединения', 'error'); }
}

async function register() {
    const name = document.getElementById('registerName')?.value;
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    const confirm = document.getElementById('registerConfirmPassword')?.value;
    if (!name || !email || !password) return showNotification('Заполните все поля', 'error');
    if (password !== confirm) return showNotification('Пароли не совпадают', 'error');
    if (password.length < 4) return showNotification('Пароль минимум 4 символа', 'error');
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (res.ok) {
            currentUser = await res.json();
            updateUIForAuth();
            closeAllModals();
            showNotification('Регистрация успешна!');
            location.reload();
        } else {
            const err = await res.json();
            showNotification(err.error || 'Ошибка регистрации', 'error');
        }
    } catch(e) { showNotification('Ошибка соединения', 'error'); }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
    } catch(e) { showNotification('Ошибка выхода', 'error'); }
}

function openProfile() {
    if (!currentUser) return openAuthModal();
    document.getElementById('profileSection')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
    if (typeof loadUserBookings === 'function') loadUserBookings();
}

function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'bookings') {
        document.querySelector('.profile-tab:first-child')?.classList.add('active');
        if (typeof loadUserBookings === 'function') loadUserBookings();
    } else {
        document.querySelector('.profile-tab:last-child')?.classList.add('active');
        showProfileSettings();
    }
}

function showProfileSettings() {
    const content = document.getElementById('profileContent');
    if (!content) return;
    content.innerHTML = `
        <div style="background: var(--bg-card); padding: 2rem; border-radius: 20px;">
            <h3>Настройки профиля</h3>
            <div class="form-group"><label>Имя</label><input type="text" id="settingsName" value="${escapeHtml(currentUser.name)}"></div>
            <div class="form-group"><label>Телефон</label><input type="text" id="settingsPhone" value="${escapeHtml(currentUser.phone || '')}"></div>
            <div class="form-group"><label>Email</label><input type="email" value="${escapeHtml(currentUser.email)}" disabled></div>
            <button class="auth-submit" onclick="updateProfile()">💾 Сохранить</button>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function updateProfile() {
    const name = document.getElementById('settingsName')?.value;
    const phone = document.getElementById('settingsPhone')?.value;
    if (!name) return showNotification('Имя не может быть пустым', 'error');
    try {
        const res = await fetch('/api/user/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        if (res.ok) {
            currentUser.name = name;
            currentUser.phone = phone;
            showNotification('Профиль обновлён');
            document.getElementById('userName').textContent = name;
        }
    } catch(e) { showNotification('Ошибка', 'error'); }
}