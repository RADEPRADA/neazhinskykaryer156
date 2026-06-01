process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'nezhinskiy-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Подключение к SQLite
const db = new sqlite3.Database('./cinema.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        
        // Таблица users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            avatar_url TEXT,
            bio TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, (err) => {});
        
        // Таблица genres
        db.run(`CREATE TABLE IF NOT EXISTS genres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);
        
        // Таблица movies (материалы)
        db.run(`CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL UNIQUE,
            description TEXT,
            duration_minutes INTEGER,
            release_year TEXT,
            poster_url TEXT,
            genre_id INTEGER,
            rating INTEGER
        )`);
        
        // Таблица requests (заявки) с user_id
        db.run(`CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            phone TEXT NOT NULL,
            messenger TEXT NOT NULL,
            messenger_contact TEXT NOT NULL,
            material_id INTEGER NOT NULL,
            volume REAL NOT NULL,
            client_type TEXT NOT NULL,
            comment TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (material_id) REFERENCES movies(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        // Таблица reviews (отзывы)
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movie_id INTEGER,
            user_id INTEGER NOT NULL,
            rating INTEGER DEFAULT 5,
            comment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (movie_id) REFERENCES movies(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        // Жанры
        db.run(`INSERT OR IGNORE INTO genres (id, name) VALUES 
            (1, 'ПГС'), (2, 'Щебень'), (3, 'Песок'), (4, 'Глина'),
            (5, 'Гравий'), (6, 'Отсев'), (7, 'Керамзит'), (8, 'Известняк'),
            (9, 'Доломит'), (10, 'Грунт')`);
        
        // Материалы
        const materials = [
            { title: 'ПГС (песчано-гравийная смесь)', description: 'ПГС — песчано-гравийная смесь. Природная смесь с содержанием гравия до 30%. Идеально для дорожных работ.', duration_minutes: 850, release_year: '2017', poster_url: 'https://stroyresurs02.ru/wp-content/uploads/2015/04/pgs.jpg', genre_id: 1, rating: 5 },
            { title: 'Щебень гранитный', description: 'Щебень гранитный фракции 5-20 мм. Для бетона и фундаментов.', duration_minutes: 1250, release_year: '2014', poster_url: 'https://50.img.avito.st/image/1/1.rwvj5La4A-LVTcHnsb6dLZdGAeRdRYHqlUAB4FNNC-hV.16Nt7A2l-cRU3JSDU4RPwXvm9QFqsGjqLRsehwUwVTE', genre_id: 2, rating: 5 },
            { title: 'Песок строительный', description: 'Мытый карьерный песок. Для бетона, штукатурки.', duration_minutes: 650, release_year: '2018', poster_url: 'https://7607056.ru/images/1806/33.jpg', genre_id: 3, rating: 4 },
            { title: 'Глина техническая', description: 'Техническая глина для строительства и керамики.', duration_minutes: 450, release_year: '2017', poster_url: 'https://via.placeholder.com/300x260?text=Глина', genre_id: 4, rating: 4 },
            { title: 'Гравий речной', description: 'Речной гравий фракции 5-40 мм. Для дренажа и бетона.', duration_minutes: 950, release_year: '5-40 мм', poster_url: 'https://via.placeholder.com/300x260?text=Гравий', genre_id: 5, rating: 4 },
            { title: 'Отсев гранитный', description: 'Гранитный отсев для отсыпки дорожек.', duration_minutes: 550, release_year: '0-5 мм', poster_url: 'https://via.placeholder.com/300x260?text=Отсев', genre_id: 6, rating: 3 },
            { title: 'Керамзит', description: 'Керамзит для утепления.', duration_minutes: 1200, release_year: '10-20 мм', poster_url: 'https://via.placeholder.com/300x260?text=Керамзит', genre_id: 7, rating: 5 },
            { title: 'Известняк дроблёный', description: 'Известняк для почв и извести.', duration_minutes: 750, release_year: '20-40 мм', poster_url: 'https://via.placeholder.com/300x260?text=Известняк', genre_id: 8, rating: 4 },
            { title: 'Доломитовая мука', description: 'Доломитовая мука для почв.', duration_minutes: 500, release_year: '0-1 мм', poster_url: 'https://via.placeholder.com/300x260?text=Доломит', genre_id: 9, rating: 3 },
            { title: 'Грунт растительный', description: 'Плодородный грунт для газонов.', duration_minutes: 300, release_year: 'насыпной', poster_url: 'https://via.placeholder.com/300x260?text=Грунт', genre_id: 10, rating: 4 }
        ];
        
        materials.forEach(m => {
            db.run(`INSERT OR IGNORE INTO movies (title, description, duration_minutes, release_year, poster_url, genre_id, rating)
                VALUES (?, ?, ?, ?, ?, ?, ?)`, [m.title, m.description, m.duration_minutes, m.release_year, m.poster_url, m.genre_id, m.rating]);
        });
        console.log('✅ 10 материалов добавлены');
    }
});

// Helper functions
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve({ id: this.lastID, changes: this.changes }); });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

// ========== MIDDLEWARE ==========
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        if (req.xhr || req.headers['content-type'] === 'application/json' || req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Не авторизован', redirect: '/login' });
        } else {
            res.redirect('/login?error=not_authorized');
        }
    }
};

const isAdmin = (req, res, next) => req.session.user && req.session.user.role === 'admin' ? next() : res.status(403).json({ error: 'Доступ запрещен' });

const sendHtmlFile = (res, filename) => {
    const filePath = path.join(__dirname, 'views', filename);
    fs.existsSync(filePath) ? res.sendFile(filePath) : res.status(404).send(`<h1>404</h1><p>${filename} не найден</p>`);
};

// ========== GIGACHAT ==========
let gigaToken = null;
let tokenExpiresAt = 0;

async function getGigaToken() {
    if (gigaToken && Date.now() < tokenExpiresAt) {
        console.log('✅ Используем существующий токен');
        return gigaToken;
    }
    
    try {
        console.log('🔄 Получаем новый токен GigaChat...');
        
        const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'RqUID': crypto.randomUUID(),
                'Authorization': `Basic ${process.env.GIGA_AUTH_KEY}`
            },
            body: 'scope=GIGACHAT_API_PERS'
        });
        
        console.log('Статус ответа:', response.status);
        
        const data = await response.json();
        console.log('Ответ получен');
        
        if (data.access_token) {
            gigaToken = data.access_token;
            tokenExpiresAt = Date.now() + ((data.expires_at || 1800) * 1000);
            console.log('✅ Токен GigaChat получен');
            return gigaToken;
        } else {
            console.error('❌ Ошибка:', data);
            return null;
        }
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        return null;
    }
}

async function askGigaChat(userMessage) {
    const token = await getGigaToken();
    if (!token) {
        throw new Error('Не удалось получить токен GigaChat');
    }
    
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            model: 'GigaChat',
            messages: [
                { role: 'system', content: `Ты - AI-помощник карьера "Нежинский карьер". Отвечай кратко и по делу. Твоя специализация: нерудные материалы (ПГС, щебень, песок, глина, гравий, отсев, керамзит, известняк, доломит, грунт), цены, доставка по Оренбургской области, телефон +7 (969) 331-78-90, адрес: Оренбургская обл., ул. Казаковская 56, скидка 20% для юрлиц. Если вопрос не по теме - вежливо откажись.` },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 500
        })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
    } else {
        throw new Error(data.error?.message || 'Ошибка GigaChat');
    }
}

// ========== СТРАНИЦЫ ==========
app.get('/', (req, res) => sendHtmlFile(res, 'index.html'));
app.get('/login', (req, res) => sendHtmlFile(res, 'login.html'));
app.get('/register', (req, res) => sendHtmlFile(res, 'register.html'));
app.get('/schedule', (req, res) => sendHtmlFile(res, 'schedule.html'));
app.get('/reviews-page', (req, res) => sendHtmlFile(res, 'reviews.html'));
app.get('/movies-page', (req, res) => sendHtmlFile(res, 'movies.html'));
app.get('/admin', isAdmin, (req, res) => sendHtmlFile(res, 'admin.html'));
app.get('/profile', isAuthenticated, (req, res) => sendHtmlFile(res, 'profile.html'));
app.get('/request', (req, res) => sendHtmlFile(res, 'request.html'));

// ========== API МАТЕРИАЛЫ ==========
app.get('/movies', async (req, res) => {
    try {
        const movies = await dbAll(`SELECT movies.*, genres.name as genre_name FROM movies LEFT JOIN genres ON movies.genre_id = genres.id WHERE movies.title IS NOT NULL ORDER BY movies.id`);
        res.json(movies);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/genres', async (req, res) => {
    const genres = await dbAll('SELECT * FROM genres ORDER BY name');
    res.json(genres);
});

// ========== API ОТЗЫВЫ ==========
app.get('/reviews', async (req, res) => {
    try {
        const reviews = await dbAll(`
            SELECT r.*, u.username, u.avatar_url, m.title as movie_title 
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN movies m ON r.movie_id = m.id
            ORDER BY r.created_at DESC
            LIMIT 100
        `);
        res.json(reviews);
    } catch (err) {
        console.error('Ошибка загрузки отзывов:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/reviews/:movieId', async (req, res) => {
    try {
        const movieId = req.params.movieId;
        console.log(`Запрос отзывов для материала ID: ${movieId}`);
        
        if (!movieId || isNaN(movieId)) {
            return res.status(400).json({ error: 'Неверный ID материала' });
        }
        
        const reviews = await dbAll(`
            SELECT r.*, u.username, u.avatar_url, m.title as movie_title 
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN movies m ON r.movie_id = m.id
            WHERE r.movie_id = ?
            ORDER BY r.created_at DESC
        `, [movieId]);
        
        console.log(`Найдено отзывов: ${reviews.length}`);
        res.json(reviews);
    } catch (err) {
        console.error('Ошибка загрузки отзывов для материала:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/reviews', isAuthenticated, async (req, res) => {
    try {
        const { movie_id, rating, comment } = req.body;
        
        if (!movie_id || !rating || !comment) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        const result = await dbRun(
            'INSERT INTO reviews (movie_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
            [movie_id, req.session.user.id, rating, comment]
        );
        res.json({ success: true, id: result.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ========== АВТОРИЗАЦИЯ ==========
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const existing = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) return res.status(400).json({ error: 'Пользователь уже существует' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await dbRun('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
    const newUser = await dbGet('SELECT id, username, email, role, avatar_url, bio FROM users WHERE id = ?', [result.id]);
    req.session.user = newUser;
    res.json({ success: true, user: newUser });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ error: 'Неверные данные' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });
    req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role || 'user', avatar_url: user.avatar_url, bio: user.bio };
    res.json({ success: true, user: req.session.user });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/user', (req, res) => { res.json({ user: req.session.user || null }); });

// ========== ПРОФИЛЬ ==========
app.get('/api/user/profile', isAuthenticated, async (req, res) => {
    const user = await dbGet('SELECT id, username, email, role, avatar_url, bio, created_at FROM users WHERE id = ?', [req.session.user.id]);
    res.json({ success: true, user });
});

app.put('/api/user/profile', isAuthenticated, async (req, res) => {
    const { username, email, bio } = req.body;
    await dbRun('UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email), bio = ? WHERE id = ?', [username, email, bio, req.session.user.id]);
    const updated = await dbGet('SELECT id, username, email, role, avatar_url, bio FROM users WHERE id = ?', [req.session.user.id]);
    req.session.user = updated;
    res.json({ success: true, user: updated });
});

app.put('/api/user/avatar', isAuthenticated, async (req, res) => {
    await dbRun('UPDATE users SET avatar_url = ? WHERE id = ?', [req.body.avatar_url, req.session.user.id]);
    const updated = await dbGet('SELECT id, username, email, role, avatar_url, bio FROM users WHERE id = ?', [req.session.user.id]);
    req.session.user = updated;
    res.json({ success: true, user: updated });
});

app.put('/api/user/password', isAuthenticated, async (req, res) => {
    const user = await dbGet('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
    const valid = await bcrypt.compare(req.body.current_password, user.password);
    if (!valid) return res.status(401).json({ error: 'Текущий пароль неверен' });
    const hashed = await bcrypt.hash(req.body.new_password, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.user.id]);
    res.json({ success: true });
});

// ========== ЗАЯВКИ ==========
// Все заявки (для админа)
app.get('/api/requests', isAdmin, async (req, res) => {
    const requests = await dbAll(`SELECT r.*, m.title as material_name FROM requests r JOIN movies m ON r.material_id = m.id ORDER BY r.created_at DESC`);
    res.json(requests);
});

// Создание заявки (с привязкой к пользователю, если авторизован)
app.post('/api/requests', async (req, res) => {
    const { phone, messenger, messenger_contact, material_id, volume, client_type, comment } = req.body;
    if (!phone || !messenger || !messenger_contact || !material_id || !volume || !client_type) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    let userId = null;
    if (req.session.user) {
        userId = req.session.user.id;
    }
    
    const result = await dbRun(
        `INSERT INTO requests (user_id, phone, messenger, messenger_contact, material_id, volume, client_type, comment, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [userId, phone, messenger, messenger_contact, material_id, volume, client_type, comment || null]
    );
    res.json({ success: true, id: result.id });
});

// Заявки текущего пользователя
app.get('/api/user/requests', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const requests = await dbAll(`
            SELECT r.*, m.title as material_name 
            FROM requests r 
            JOIN movies m ON r.material_id = m.id 
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);
        
        res.json({ success: true, requests });
    } catch (err) {
        console.error('Ошибка загрузки заявок пользователя:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/requests/:id/status', isAdmin, async (req, res) => {
    await dbRun('UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true });
});

app.delete('/api/requests/:id', isAdmin, async (req, res) => {
    await dbRun('DELETE FROM requests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

// ========== АДМИН ==========
app.get('/api/admin/users', isAdmin, async (req, res) => {
    const users = await dbAll('SELECT id, username, email, role, avatar_url, bio, created_at FROM users');
    res.json(users);
});

app.put('/api/admin/users/:id/role', isAdmin, async (req, res) => {
    await dbRun('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.id]);
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    if (req.session.user.id == req.params.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
    await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/admin/reviews/:id', isAdmin, async (req, res) => {
    await dbRun('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

app.post('/api/movies', isAdmin, async (req, res) => {
    const { title, description, duration_minutes, release_year, poster_url, genre_id, rating } = req.body;
    const result = await dbRun(`INSERT INTO movies (title, description, duration_minutes, release_year, poster_url, genre_id, rating) VALUES (?, ?, ?, ?, ?, ?, ?)`, [title, description, duration_minutes, release_year, poster_url, genre_id, rating]);
    res.json({ success: true, id: result.id });
});

// ========== ЧАТ ==========
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message || '';
        console.log(`💬 Вопрос: ${userMessage}`);
        const reply = await askGigaChat(userMessage);
        console.log(`🤖 Ответ: ${reply}`);
        res.json({ reply });
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        res.status(500).json({ reply: 'Извините, сервис временно недоступен. Позвоните нам по телефону +7 (969) 331-78-90' });
    }
});

// ========== ЗАПУСК ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`👑 Админ-панель: http://localhost:${PORT}/admin`);
});
