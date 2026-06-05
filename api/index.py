from flask import Flask, request, jsonify, session, render_template_string, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import json
import os
import tempfile

app = Flask(__name__, 
           static_folder='static',
           static_url_path='/static')
app.secret_key = 'secret-key-for-photorent-2024'
CORS(app)

# SQLite в временной папке Vercel
db_path = os.path.join(tempfile.gettempdir(), 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# ============= МОДЕЛИ =============

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    phone = db.Column(db.String(20), default='')
    address = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    image = db.Column(db.String(500), default='')
    description = db.Column(db.String(500))
    is_new = db.Column(db.Boolean, default=False)
    in_stock = db.Column(db.Boolean, default=True)
    popularity = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.Column(db.Text, nullable=False)
    start_date = db.Column(db.String(20), nullable=False)
    end_date = db.Column(db.String(20), nullable=False)
    days = db.Column(db.Integer, nullable=False)
    total = db.Column(db.Integer, nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)
    delivery_method = db.Column(db.String(50), default='pickup')
    delivery_address = db.Column(db.String(500), default='')
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_approved = db.Column(db.Boolean, default=True)


class BlockedDate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, nullable=False)
    date = db.Column(db.String(20), nullable=False)
    booking_id = db.Column(db.Integer, nullable=True)


class Cart(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, default=1)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)


# ============= ФУНКЦИИ =============

def update_expired_bookings():
    today = datetime.now().strftime('%Y-%m-%d')
    expired = Booking.query.filter(Booking.status == 'active', Booking.end_date < today).all()
    for booking in expired:
        booking.status = 'completed'
    to_activate = Booking.query.filter(Booking.status == 'pending', Booking.start_date <= today).all()
    for booking in to_activate:
        booking.status = 'active'
    if expired or to_activate:
        db.session.commit()


def init_db():
    with app.app_context():
        db.create_all()

        # Создаём админа
        if not User.query.filter_by(email='admin@admin.com').first():
            admin = User(name='Администратор', email='admin@admin.com', password='admin123', is_admin=True)
            db.session.add(admin)

        # Создаём тестового пользователя
        if not User.query.filter_by(email='user@user.com').first():
            user = User(name='Тестовый Пользователь', email='user@user.com', password='user123', is_admin=False)
            db.session.add(user)

        db.session.commit()

        # Загружаем товары из products.json если их нет в БД
        if Product.query.count() == 0:
            products_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'products.json')
            
            # Если файла нет, создаём с данными по умолчанию
            if not os.path.exists(products_path):
                default_products = {
                    "products": [
                        {"id": 1, "name": "Sony A7 III", "category": "cameras", "price": 2500, "image": "/static/images/sony-a7iii.jpg", "description": "Полнокадровая беззеркальная камера 24MP", "is_new": True, "popularity": 95},
                        {"id": 2, "name": "Canon EOS R5", "category": "cameras", "price": 3500, "image": "/static/images/canon-eos-r5.jpg", "description": "Профессиональная беззеркальная камера 45MP", "is_new": True, "popularity": 98},
                        {"id": 3, "name": "Sony FE 24-70mm f/2.8 GM", "category": "lenses", "price": 1800, "image": "/static/images/sony-24-70mm.jpg", "description": "Профессиональный зум-объектив", "is_new": False, "popularity": 92},
                        {"id": 4, "name": "DJI Ronin-S", "category": "stabilizers", "price": 800, "image": "/static/images/dji-ronin-s.jpg", "description": "Трехосевой стабилизатор для камер", "is_new": False, "popularity": 88},
                        {"id": 5, "name": "Canon EF 70-200mm f/2.8L IS III", "category": "lenses", "price": 2200, "image": "/static/images/canon-70-200mm.jpg", "description": "Телеобъектив для спорта и природы", "is_new": False, "popularity": 94},
                        {"id": 6, "name": "Blackmagic Pocket Cinema 6K", "category": "video", "price": 2800, "image": "/static/images/blackmagic-6k.jpg", "description": "Профессиональная кинокамера 6K", "is_new": True, "popularity": 96},
                        {"id": 7, "name": "Aputure 120d II", "category": "light", "price": 600, "image": "/static/images/aputure-120d.jpg", "description": "Светодиодный осветитель 120W", "is_new": False, "popularity": 85},
                        {"id": 8, "name": "Rode NTG4+", "category": "audio", "price": 400, "image": "/static/images/rode-ntg4.jpg", "description": "Профессиональный направленный микрофон", "is_new": False, "popularity": 82}
                    ]
                }
                os.makedirs(os.path.dirname(products_path), exist_ok=True)
                with open(products_path, 'w', encoding='utf-8') as f:
                    json.dump(default_products, f, ensure_ascii=False, indent=2)
                print(f"✅ Создан файл products.json с {len(default_products['products'])} товарами")

            # Загружаем из JSON
            with open(products_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for p in data['products']:
                    product = Product(
                        id=p['id'],
                        name=p['name'],
                        category=p['category'],
                        price=p['price'],
                        image=p.get('image', ''),
                        description=p.get('description', ''),
                        is_new=p.get('is_new', False),
                        popularity=p.get('popularity', 0),
                        in_stock=True
                    )
                    db.session.add(product)
                db.session.commit()
                print(f"✅ Загружено {len(data['products'])} товаров из products.json")

        # Добавляем тестовые отзывы
        if Review.query.count() == 0:
            test_reviews = [
                (1, 'Алексей', 5, 'Отличный сервис! Камера в идеальном состоянии. Обязательно обращусь еще!'),
                (1, 'Елена', 5, 'Брала объектив для свадьбы, клиенты в восторге. Спасибо за качественное оборудование!'),
                (1, 'Дмитрий', 5, 'Стабилизатор Ronin-S - топ! Всё работает как часы. Рекомендую!'),
            ]
            for review in test_reviews:
                r = Review(user_id=review[0], user_name=review[1], rating=review[2], text=review[3], is_approved=True)
                db.session.add(r)
            db.session.commit()
            print("✅ Добавлены тестовые отзывы")

        update_expired_bookings()


# HTML шаблон (сокращенная версия, полный в конце)
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhotoRento - Аренда фототехники в Казани</title>
    <link rel="stylesheet" href="/static/css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <header>
        <div class="nav-container">
            <a href="#" class="logo">📸 PhotoRento</a>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">☰</button>
            <nav class="nav-menu" id="navMenu">
                <a href="#catalog" onclick="showCatalog()">Каталог</a>
                <a href="#how-it-works">Как работает</a>
                <a href="#reviews">Отзывы</a>
                <a href="#contacts">Контакты</a>
                <a href="#" onclick="openAuthModal()" id="authLink">Войти</a>
                <button class="theme-toggle" onclick="toggleTheme()">
                    <i id="themeIcon" class="fas fa-moon"></i>
                </button>
                <a href="#" class="cart-btn" onclick="toggleCart()">🛒 <span id="cartCount">0</span></a>
            </nav>
        </div>
    </header>

    <main>
        <section class="hero">
            <h1>Аренда профессиональной<br>фото и видеотехники в Казани</h1>
            <p>Более 1000 единиц техники для ваших проектов</p>
            <div class="search-bar">
                <input type="text" placeholder="Поиск техники..." id="searchInput" onkeyup="searchProducts()">
                <button onclick="searchProducts()">🔍 Найти</button>
            </div>
        </section>

        <section class="categories" id="catalog">
            <h2>Категории</h2>
            <div class="category-grid">
                <div class="category-card" onclick="filterByCategory('cameras')"><i class="fas fa-camera"></i><h3>Фотоаппараты</h3></div>
                <div class="category-card" onclick="filterByCategory('lenses')"><i class="fas fa-search"></i><h3>Объективы</h3></div>
                <div class="category-card" onclick="filterByCategory('video')"><i class="fas fa-video"></i><h3>Видеокамеры</h3></div>
                <div class="category-card" onclick="filterByCategory('light')"><i class="fas fa-lightbulb"></i><h3>Свет</h3></div>
                <div class="category-card" onclick="filterByCategory('audio')"><i class="fas fa-microphone"></i><h3>Звук</h3></div>
                <div class="category-card" onclick="filterByCategory('stabilizers')"><i class="fas fa-balance-scale"></i><h3>Стабилизаторы</h3></div>
                <div class="category-card" onclick="filterByCategory('all')"><i class="fas fa-th-large"></i><h3>Все товары</h3></div>
            </div>
        </section>

        <section class="products-section">
            <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem">
                <h2>🔥 Популярные товары</h2>
                <select id="sortSelect" onchange="sortProducts()" style="padding:0.5rem 1rem; border-radius:10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border)">
                    <option value="popular">По популярности</option>
                    <option value="price-asc">Цена: по возрастанию</option>
                    <option value="price-desc">Цена: по убыванию</option>
                </select>
            </div>
            <div class="products-grid" id="productsGrid"></div>
            <div class="load-more"><button onclick="loadMoreProducts()" id="loadMoreBtn">Показать еще</button></div>
        </section>

        <section class="how-it-works" id="how-it-works">
            <h2>Как это работает</h2>
            <div class="steps-grid">
                <div class="step-card"><div class="step-number">1</div><i class="fas fa-search"></i><h3>Выберите технику</h3><p>Найдите нужное оборудование</p></div>
                <div class="step-card"><div class="step-number">2</div><i class="fas fa-calendar-alt"></i><h3>Укажите даты</h3><p>Выберите удобные даты</p></div>
                <div class="step-card"><div class="step-number">3</div><i class="fas fa-credit-card"></i><h3>Оплатите</h3><p>Безопасная оплата онлайн</p></div>
                <div class="step-card"><div class="step-number">4</div><i class="fas fa-box"></i><h3>Получите</h3><p>Самовывоз или доставка</p></div>
            </div>
        </section>

        <section class="reviews" id="reviews">
            <div class="reviews-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem">
                <h2>⭐ Отзывы клиентов</h2>
                <button class="add-review-btn" onclick="openReviewModal()" style="background:var(--gradient); border:none; padding:0.8rem 1.5rem; border-radius:50px; color:white; font-weight:600; cursor:pointer">
                    ✍️ Оставить отзыв
                </button>
            </div>
            <div class="reviews-slider" id="reviewsSlider"></div>
        </section>

        <section class="contacts" id="contacts">
            <h2>Контакты</h2>
            <div class="contacts-grid">
                <div class="contact-info">
                    <div class="contact-item"><i class="fas fa-map-marker-alt"></i><div><h3>Адрес самовывоза</h3><p>г. Казань, ул. Баумана, д. 15</p><small>ст. м. Кремлёвская</small></div></div>
                    <div class="contact-item"><i class="fas fa-phone"></i><div><h3>Телефон</h3><p>+7 (843) 123-45-67</p></div></div>
                    <div class="contact-item"><i class="fas fa-envelope"></i><div><h3>Email</h3><p>info@photorent.ru</p></div></div>
                    <div class="contact-item"><i class="fas fa-clock"></i><div><h3>Часы работы</h3><p>Пн-Пт: 10:00 - 20:00<br>Сб-Вс: 11:00 - 18:00</p></div></div>
                    <div class="pickup-details" style="background:var(--bg-secondary); padding:1rem; border-radius:12px; margin-top:1rem">
                        <h4>📍 Как добраться:</h4>
                        <p>• Выход из метро "Кремлёвская" №2</p>
                        <p>• Направо 100 метров, вход в ТЦ "Бауманский"</p>
                        <p>• Офис 305, 3 этаж</p>
                    </div>
                </div>
                <div class="contact-map">
                    <iframe src="https://yandex.ru/map-widget/v1/?ll=49.123%2C55.796&z=15" frameborder="0"></iframe>
                </div>
            </div>
        </section>
    </main>

    <div class="profile-section" id="profileSection">
        <div style="padding:2rem">
            <div class="profile-header">
                <div class="profile-avatar" id="profileAvatar">👤</div>
                <div><h2 id="userName"></h2><p id="userEmail"></p></div>
                <button class="logout-btn" onclick="logout()">🚪 Выйти</button>
            </div>
            <div class="profile-tabs">
                <button class="profile-tab active" onclick="switchProfileTab('bookings')">Мои бронирования</button>
                <button class="profile-tab" onclick="switchProfileTab('settings')">Настройки</button>
            </div>
            <div class="profile-content" id="profileContent"></div>
            <button class="logout-btn" onclick="closeAllModals()" style="margin-top:1rem; background:var(--border); color:var(--text)">✕ Закрыть</button>
        </div>
    </div>

    <div class="admin-panel" id="adminPanel">
        <div style="padding:2rem">
            <div class="profile-header">
                <h2>🛡️ Админ-панель</h2>
                <button class="logout-btn" onclick="closeAdminPanel()">✕ Закрыть</button>
            </div>
            <div class="admin-stats">
                <div class="stat-card"><i class="fas fa-users"></i><div class="stat-value" id="statTotalUsers">0</div><div>Пользователей</div></div>
                <div class="stat-card"><i class="fas fa-calendar-check"></i><div class="stat-value" id="statTotalBookings">0</div><div>Бронирований</div></div>
                <div class="stat-card"><i class="fas fa-play-circle"></i><div class="stat-value" id="statActiveBookings">0</div><div>Активных</div></div>
                <div class="stat-card"><i class="fas fa-ruble-sign"></i><div class="stat-value" id="statTotalRevenue">0 ₽</div><div>Выручка</div></div>
                <div class="stat-card"><i class="fas fa-star"></i><div class="stat-value" id="statTotalReviews">0</div><div>Отзывов</div></div>
            </div>
            <div class="admin-tabs">
                <button class="admin-tab active" onclick="switchAdminTab('stats')">📊 Статистика</button>
                <button class="admin-tab" onclick="switchAdminTab('bookings')">📋 Бронирования</button>
                <button class="admin-tab" onclick="switchAdminTab('products')">📦 Товары</button>
                <button class="admin-tab" onclick="switchAdminTab('users')">👥 Пользователи</button>
                <button class="admin-tab" onclick="switchAdminTab('reviews')">💬 Отзывы</button>
            </div>
            <div id="adminStatsContent" class="admin-tab-content"><div style="padding:2rem;text-align:center">✅ Статистика загружена выше</div></div>
            <div id="adminBookingsContent" class="admin-tab-content" style="display:none"><div class="admin-table" id="adminBookingsList"></div></div>
            <div id="adminProductsContent" class="admin-tab-content" style="display:none"><div class="admin-table" id="adminProductsList"></div></div>
            <div id="adminUsersContent" class="admin-tab-content" style="display:none"><div class="admin-table" id="adminUsersList"></div></div>
            <div id="adminReviewsContent" class="admin-tab-content" style="display:none"><div class="admin-table" id="adminReviewsList"></div></div>
        </div>
    </div>

    <div class="cart-sidebar" id="cartSidebar">
        <div style="padding:1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <h3>🛒 Корзина</h3>
            <button onclick="toggleCart()" style="background:none; border:none; font-size:1.5rem; cursor:pointer">✕</button>
        </div>
        <div class="cart-items" id="cartItems"></div>
        <div class="cart-footer">
            <div class="cart-total"><span>Итого:</span><span id="cartTotal">0 ₽</span></div>
            <button class="checkout-btn" onclick="openBookingModal()">Оформить аренду</button>
        </div>
    </div>

    <div class="overlay" id="overlay" onclick="closeAllModals()"></div>

    <div class="auth-modal" id="authModal">
        <div class="auth-tabs">
            <button class="auth-tab active" onclick="switchAuthTab('login')">Вход</button>
            <button class="auth-tab" onclick="switchAuthTab('register')">Регистрация</button>
        </div>
        <div class="auth-form active" id="loginForm">
            <div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="user@example.com"></div>
            <div class="form-group"><label>Пароль</label><input type="password" id="loginPassword" placeholder="******"></div>
            <button class="auth-submit" onclick="login()">🔑 Войти</button>
        </div>
        <div class="auth-form" id="registerForm">
            <div class="form-group"><label>Имя</label><input type="text" id="registerName" placeholder="Иван"></div>
            <div class="form-group"><label>Email</label><input type="email" id="registerEmail" placeholder="ivan@mail.ru"></div>
            <div class="form-group"><label>Пароль</label><input type="password" id="registerPassword" placeholder="******"></div>
            <div class="form-group"><label>Подтвердите</label><input type="password" id="registerConfirmPassword" placeholder="******"></div>
            <button class="auth-submit" onclick="register()">📝 Зарегистрироваться</button>
        </div>
        <button class="logout-btn" onclick="closeAllModals()" style="margin-top:1rem; width:100%">Закрыть</button>
    </div>

    <div class="booking-modal" id="bookingModal">
        <div style="padding:2rem">
            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem">
                <h3>Оформление аренды</h3>
                <button onclick="closeBookingModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer">✕</button>
            </div>
            <div class="booking-dates">
                <h4>📅 Даты аренды</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin:1rem 0">
                    <div><label>Начало</label><input type="date" id="startDate" class="date-input" onchange="calculateTotal()" style="width:100%; padding:0.5rem; border-radius:10px; background:var(--bg); color:var(--text); border:1px solid var(--border)"></div>
                    <div><label>Окончание</label><input type="date" id="endDate" class="date-input" onchange="calculateTotal()" style="width:100%; padding:0.5rem; border-radius:10px; background:var(--bg); color:var(--text); border:1px solid var(--border)"></div>
                </div>
            </div>
            <div class="booking-items" id="bookingItems"></div>
            <div class="booking-total" style="background:var(--bg-secondary); padding:1rem; border-radius:15px; margin:1rem 0">
                <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:700"><span>Итого</span><span id="totalAmount">0 ₽</span></div>
            </div>
            <button class="confirm-booking" onclick="confirmBooking()">✅ Подтвердить бронирование</button>
        </div>
    </div>

    <div class="review-modal" id="reviewModal">
        <div style="padding:2rem">
            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem">
                <h3>✍️ Оставить отзыв</h3>
                <button onclick="closeReviewModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer">✕</button>
            </div>
            <div class="form-group">
                <label>Оценка</label>
                <div class="star-rating" style="display:flex; gap:0.5rem; font-size:2rem; cursor:pointer; margin:1rem 0">
                    <i class="fas fa-star" onclick="setRating(1)"></i>
                    <i class="fas fa-star" onclick="setRating(2)"></i>
                    <i class="fas fa-star" onclick="setRating(3)"></i>
                    <i class="fas fa-star" onclick="setRating(4)"></i>
                    <i class="fas fa-star" onclick="setRating(5)"></i>
                </div>
            </div>
            <div class="form-group">
                <label>Ваш отзыв</label>
                <textarea id="reviewText" rows="4" placeholder="Расскажите о вашем опыте аренды..." style="width:100%; padding:0.8rem; border-radius:12px; border:1px solid var(--border); background:var(--bg); color:var(--text)"></textarea>
            </div>
            <button class="submit-review-btn" onclick="submitReview()" style="width:100%; background:var(--gradient); border:none; padding:1rem; border-radius:12px; color:white; font-weight:600; cursor:pointer">📝 Отправить отзыв</button>
        </div>
    </div>

    <div class="notification" id="notification"></div>

    <script src="/static/js/main.js"></script>
    <script src="/static/js/auth.js"></script>
    <script src="/static/js/cart.js"></script>
    <script src="/static/js/bookings.js"></script>
    <script src="/static/js/admin.js"></script>
</body>
</html>'''


# ============= API МАРШРУТЫ =============

@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify({'products': [{
        'id': p.id, 'name': p.name, 'category': p.category,
        'price': p.price, 'image': p.image, 'description': p.description,
        'is_new': p.is_new, 'in_stock': p.in_stock, 'popularity': p.popularity
    } for p in products]})


@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    reviews = Review.query.filter_by(is_approved=True).order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [{
        'id': r.id, 'user_name': r.user_name, 'rating': r.rating,
        'text': r.text, 'created_at': r.created_at.strftime('%d.%m.%Y')
    } for r in reviews]})


@app.route('/api/reviews/add', methods=['POST'])
def add_review():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Необходимо войти'}), 401
    data = request.json
    user = User.query.get(user_id)
    review = Review(user_id=user_id, user_name=user.name, rating=data.get('rating', 5), text=data.get('text'), is_approved=True)
    db.session.add(review)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Пользователь уже существует'}), 400
    user = User(name=data.get('name'), email=data.get('email'), password=data.get('password'))
    db.session.add(user)
    db.session.commit()
    session['user_id'] = user.id
    session['is_admin'] = user.is_admin
    return jsonify({'id': user.id, 'name': user.name, 'email': user.email, 'is_admin': user.is_admin})


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email')).first()
    if user and user.password == data.get('password'):
        session['user_id'] = user.id
        session['is_admin'] = user.is_admin
        return jsonify({'id': user.id, 'name': user.name, 'email': user.email, 'is_admin': user.is_admin})
    return jsonify({'error': 'Неверный email или пароль'}), 400


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('is_admin', None)
    return jsonify({'success': True})


@app.route('/api/user', methods=['GET'])
def current_user():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({'id': user.id, 'name': user.name, 'email': user.email, 'phone': user.phone, 'address': user.address, 'is_admin': user.is_admin})
    return jsonify({'error': 'Не авторизован'}), 401


@app.route('/api/user/update', methods=['PUT'])
def update_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    user = User.query.get(user_id)
    data = request.json
    if 'name' in data:
        user.name = data['name']
    if 'phone' in data:
        user.phone = data['phone']
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/bookings', methods=['POST'])
def create_booking():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    data = request.json
    booking = Booking(
        user_id=user_id,
        items=json.dumps(data.get('items')),
        start_date=data.get('startDate'),
        end_date=data.get('endDate'),
        days=data.get('days'),
        total=data.get('total'),
        payment_method=data.get('paymentMethod', 'card'),
        delivery_method=data.get('deliveryMethod', 'pickup'),
        delivery_address=data.get('deliveryAddress', '')
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify({'id': booking.id, 'message': 'Бронирование успешно создано'})


@app.route('/api/bookings/list', methods=['GET'])
def user_bookings():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Не авторизован'}), 401
    update_expired_bookings()
    bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.created_at.desc()).all()
    return jsonify({'bookings': [{
        'id': b.id, 'items': json.loads(b.items), 'startDate': b.start_date,
        'endDate': b.end_date, 'days': b.days, 'total': b.total, 'status': b.status
    } for b in bookings]})


@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    update_expired_bookings()
    total_revenue = db.session.query(db.func.sum(Booking.total)).filter(Booking.status == 'active').scalar() or 0
    return jsonify({
        'total_users': User.query.count(),
        'total_bookings': Booking.query.count(),
        'active_bookings': Booking.query.filter_by(status='active').count(),
        'total_revenue': total_revenue,
        'total_reviews': Review.query.count()
    })


@app.route('/api/admin/bookings', methods=['GET'])
def admin_bookings():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    update_expired_bookings()
    bookings = Booking.query.order_by(Booking.created_at.desc()).all()
    result = []
    for b in bookings:
        user = User.query.get(b.user_id)
        result.append({
            'id': b.id, 'user_name': user.name if user else 'Неизвестно',
            'user_email': user.email if user else 'Неизвестно',
            'items': json.loads(b.items), 'startDate': b.start_date,
            'endDate': b.end_date, 'days': b.days, 'total': b.total, 'status': b.status
        })
    return jsonify({'bookings': result})


@app.route('/api/admin/bookings/<int:booking_id>/status', methods=['PUT'])
def update_booking_status(booking_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    booking = Booking.query.get(booking_id)
    if booking:
        booking.status = request.json.get('status', booking.status)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/admin/bookings/<int:booking_id>/delete', methods=['DELETE'])
def delete_booking(booking_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    booking = Booking.query.get(booking_id)
    if booking:
        db.session.delete(booking)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/admin/products', methods=['GET'])
def admin_products():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    products = Product.query.all()
    return jsonify({'products': [{
        'id': p.id, 'name': p.name, 'category': p.category,
        'price': p.price, 'in_stock': p.in_stock, 'is_new': p.is_new,
        'image': p.image, 'description': p.description
    } for p in products]})


@app.route('/api/admin/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    product = Product.query.get(product_id)
    if product:
        data = request.json
        if 'price' in data:
            product.price = data['price']
        if 'in_stock' in data:
            product.in_stock = data['in_stock']
        if 'is_new' in data:
            product.is_new = data['is_new']
        if 'name' in data:
            product.name = data['name']
        if 'description' in data:
            product.description = data['description']
        if 'category' in data:
            product.category = data['category']
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/admin/products/add', methods=['POST'])
def add_product():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    data = request.json
    max_id = db.session.query(db.func.max(Product.id)).scalar() or 0
    product = Product(
        id=max_id + 1,
        name=data.get('name'),
        category=data.get('category'),
        price=int(data.get('price')),
        image=data.get('image', ''),
        description=data.get('description', ''),
        is_new=data.get('is_new', False),
        in_stock=True
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({'success': True, 'id': product.id})


@app.route('/api/admin/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    product = Product.query.get(product_id)
    if product:
        db.session.delete(product)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    users = User.query.all()
    return jsonify({'users': [{
        'id': u.id, 'name': u.name, 'email': u.email,
        'phone': u.phone, 'is_admin': u.is_admin
    } for u in users]})


@app.route('/api/admin/reviews', methods=['GET'])
def admin_reviews():
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    reviews = Review.query.order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [{
        'id': r.id, 'user_name': r.user_name, 'rating': r.rating,
        'text': r.text, 'created_at': r.created_at.strftime('%d.%m.%Y')
    } for r in reviews]})


@app.route('/api/admin/reviews/<int:review_id>/delete', methods=['DELETE'])
def delete_review(review_id):
    if not session.get('is_admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    review = Review.query.get(review_id)
    if review:
        db.session.delete(review)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)


@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)


# Инициализация БД
init_db()


if __name__ == '__main__':
    app.run(debug=True, port=5000)