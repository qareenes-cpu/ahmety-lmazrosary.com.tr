const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const os = require('os');
require('dotenv').config();

const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
let pool;
const initDB = async () => {
    try {
        // First, connect without a database to ensure it exists
        const connectionPre = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || ''
        });
        await connectionPre.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ahmet_taslak_db'}\``);
        await connectionPre.end();

        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'ahmet_taslak_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Create tables if they don't exist
        const connection = await pool.getConnection();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price VARCHAR(100),
                category VARCHAR(100),
                description TEXT,
                sku VARCHAR(100),
                serial VARCHAR(100) UNIQUE,
                cert_code VARCHAR(100),
                artist VARCHAR(100),
                material VARCHAR(100),
                bead_count VARCHAR(50),
                bead_size VARCHAR(100),
                motif VARCHAR(100),
                imame_size VARCHAR(100),
                featured BOOLEAN DEFAULT FALSE,
                in_stock BOOLEAN DEFAULT TRUE,
                images TEXT,
                filter VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Ensure cert_code and unique serial exist
        try {
            await connection.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cert_code VARCHAR(100) AFTER serial`);
        } catch (e) { /* ignore if already exists */ }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings(
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255)
            )
            `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories(
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL
            )
            `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS hero_images(
                id INT AUTO_INCREMENT PRIMARY KEY,
                image_url VARCHAR(500) NOT NULL,
                title VARCHAR(255),
                subtitle VARCHAR(255),
                display_order INT DEFAULT 0,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS site_images(
                id INT AUTO_INCREMENT PRIMARY KEY,
                section_key VARCHAR(100) UNIQUE NOT NULL,
                section_label VARCHAR(255) NOT NULL,
                image_url VARCHAR(500) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            `);

        // Seed default site images if empty
        const [siteImgRows] = await connection.query('SELECT COUNT(*) as count FROM site_images');
        if (siteImgRows[0].count === 0) {
            const defaultSiteImages = [
                ['hero_bg', 'Hero Arka Plan (Zamanın Ötesinde Bir Miras)', 'assets/visuals/hero_bg.png'],
                ['intro_visual', 'Tanıtım Görseli (Gelenek ve Lüksün Buluşması)', 'assets/visuals/intro_tesbih.png'],
                ['masterpiece_visual', 'Ustalık Eseri Görseli', 'assets/visuals/masterpiece_detail.png']
            ];
            for (const [key, label, url] of defaultSiteImages) {
                await connection.query('INSERT IGNORE INTO site_images (section_key, section_label, image_url) VALUES (?, ?, ?)', [key, label, url]);
            }
        }

        // Initialize default settings
        await connection.query(`
            INSERT IGNORE INTO settings(setting_key, setting_value) VALUES('show_price', 'true')
            `);

        // Seed default categories if empty
        const [catRows] = await connection.query('SELECT COUNT(*) as count FROM categories');
        if (catRows[0].count === 0) {
            const defaultCats = [
                'Kehribar Tespihler', 'Damla Kehribar', 'Sıkma Kehribar', 'Ateş Kehribar',
                'Zar Kehribar', 'Osmanlı Sıkma', 'Katalin Tespihler', 'Oltu Tespihler',
                'Kuka Tespihler', 'Gümüş Tespihler', 'Gümüş İşlemeli', 'Hayvansal Grubu',
                'Doğal Taşlar', 'Genel'
            ];
            for (const cat of defaultCats) {
                await connection.query('INSERT IGNORE INTO categories (name) VALUES (?)', [cat]);
            }
        }

        // Seed default hero image if empty
        const [heroRows] = await connection.query('SELECT COUNT(*) as count FROM hero_images');
        if (heroRows[0].count === 0) {
            await connection.query(
                'INSERT INTO hero_images (image_url, title, subtitle, display_order) VALUES (?, ?, ?, ?)',
                ['assets/amber-tesbih.png', 'Ahmet Yılmaz Rosary', 'El İşçiliği Tespih Koleksiyonu', 1]
            );
        }

        connection.release();
        console.log('✅ Veritabanı bağlantısı ve tablolar hazır.');
    } catch (err) {
        console.error('❌ Veritabanı hatası:', err.message);
    }
};

initDB();

// API Endpoints
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        // Parse JSON images
        const products = rows.map(p => ({
            ...p,
            images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images
        }));
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
        const [result] = await pool.query(
            'INSERT INTO products (name, price, category, description, sku, serial, artist, material, bead_count, bead_size, motif, imame_size, featured, in_stock, images, filter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [p.name, p.price, p.category, p.desc, p.sku, p.serial, p.artist, p.material, p.beadCount, p.beadSize, p.motif, p.imameSize, p.featured, p.inStock, JSON.stringify(p.images), p.filter]
        );
        res.json({ id: result.insertId, message: 'Ürün başarıyla eklendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const p = req.body;
        await pool.query(
            'UPDATE products SET name=?, price=?, category=?, description=?, sku=?, serial=?, artist=?, material=?, bead_count=?, bead_size=?, motif=?, imame_size=?, featured=?, in_stock=?, images=?, filter=? WHERE id=?',
            [p.name, p.price, p.category, p.desc, p.sku, p.serial, p.artist, p.material, p.beadCount, p.beadSize, p.motif, p.imameSize, p.featured, p.inStock, JSON.stringify(p.images), p.filter, id]
        );
        res.json({ message: 'Ürün güncellendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Ürün silindi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Settings Endpoints
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Endpoint
app.post('/api/upload', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Dosya yüklenmedi' });
        }

        const urls = req.files.map(file => `uploads/${file.filename}`);
        res.json({ urls });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await pool.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
        );
        res.json({ message: 'Ayarlar güncellendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Category Endpoints
app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Kategori adı gerekli' });

        await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ message: 'Kategori eklendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ message: 'Kategori silindi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Hero Images Endpoints
app.get('/api/hero-images', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM hero_images WHERE active = TRUE ORDER BY display_order ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/hero-images', async (req, res) => {
    try {
        const { image_url, title, subtitle } = req.body;
        if (!image_url) return res.status(400).json({ error: 'Görsel URL gerekli' });

        const [result] = await pool.query(
            'INSERT INTO hero_images (image_url, title, subtitle, display_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM hero_images h))',
            [image_url, title || '', subtitle || '']
        );
        res.json({ id: result.insertId, message: 'Hero görsel eklendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/hero-images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM hero_images WHERE id = ?', [id]);
        res.json({ message: 'Hero görsel silindi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Site Images Endpoints
app.get('/api/site-images', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM site_images ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/site-images/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { image_url } = req.body;
        if (!image_url) return res.status(400).json({ error: 'Görsel URL gerekli' });

        await pool.query(
            'UPDATE site_images SET image_url = ? WHERE section_key = ?',
            [image_url, key]
        );
        res.json({ message: 'Site görseli güncellendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Certificate Verification Endpoint
app.get('/api/verify-certificate', async (req, res) => {
    try {
        const { serial } = req.query;
        if (!serial) {
            return res.status(400).json({ error: 'Lütfen sertifika numarasını giriniz.' });
        }

        const [rows] = await pool.query('SELECT * FROM products WHERE serial = ?', [serial]);

        if (rows.length > 0) {
            const product = rows[0];
            // Format images and response
            if (typeof product.images === 'string') {
                product.images = JSON.parse(product.images);
            }
            // Remove sensitive data (like cert_code if exists)
            delete product.cert_code;

            res.json({ success: true, product });
        } else {
            res.json({ success: false, message: 'Bu sertifika numarasına ait kayıt bulunamadı. Lütfen bilgilerinizi kontrol ediniz.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files
app.use(express.static(__dirname));

// Fallback for HTML5 history
app.get('*', (req, res) => {
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
};

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`========================================`);
    console.log(`🚀 Sunucu başlatıldı!`);
    console.log(`💻 Yerel: http://localhost:${PORT}`);
    console.log(`📱 Ağda:    http://${localIP}:${PORT}`);
    console.log(`📁 Dizin:   ${__dirname}`);
    console.log(`========================================`);
});
