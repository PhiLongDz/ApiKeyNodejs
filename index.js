const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const { machineIdSync } = require('node-machine-id');

const app = express();
const port = 3000;

// Kết nối đến database SQLite
const db = new sqlite3.Database('./database.sqlite3', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});


app.use(express.json());


db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        hwid TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
    )`);
});


app.post('/generate-key', (req, res) => {
    const key = uuidv4(); // Tạo một UUID làm key
    const hwid = machineIdSync(); // Lấy HWID của máy
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 giờ sau

    const sql = 'INSERT INTO keys (key, hwid, created_at, expires_at) VALUES (?, ?, ?, ?)';
    db.run(sql, [key, hwid, createdAt.toISOString(), expiresAt.toISOString()], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            key,
            hwid,
            created_at: createdAt,
            expires_at: expiresAt
        });
    });
});


app.get('/validate-key/:key', (req, res) => {
    const { key } = req.params;
    const hwid = machineIdSync(); // Lấy HWID 
    const sql = 'SELECT * FROM keys WHERE key = ? AND hwid = ? AND expires_at > CURRENT_TIMESTAMP';

    db.get(sql, [key, hwid], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (row) {
            const date = new Date(row.expires_at)
            const unixTimestamp = date.getTime();
            const thoi_gian_con_lai = unixTimestamp - Date.now()
            res.json({ valid: true, message: 'Key hợp lệ và khớp với HWID', expiresAt: unixTimestamp, remaining_time: thoi_gian_con_lai        });
        } else {
            res.json({ valid: false, message: 'Key sai, hết hạn, hoặc là do không khớp với HWID' });
        }
    });
});


app.get('/system-info', (req, res) => {
    const os = require('os');
    const systemInfo = {
        hostname: os.hostname(),
        platform: os.platform(),
        totalMemory: os.totalmem(),
        arch: os.arch(),
        cpus: os.cpus(),
        networkInterfaces: os.networkInterfaces(),
        hwid: machineIdSync(),
    };
    res.json(systemInfo);
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
