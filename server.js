const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Config comes from environment variables so the same code runs locally, in Docker and in CI
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'user_db',
  connectionLimit: 10,
});

async function initDb(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE
      )`);
      return;
    } catch (err) {
      console.log(`DB not ready (${i + 1}/${retries}): ${err.code}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database unavailable');
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// Health check: used by Postman monitors, Docker and Kubernetes probes
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

// Create
app.post('/users', wrap(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const [result] = await pool.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
  res.status(201).json({ id: result.insertId, name, email });
}));

// Read all
app.get('/users', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users');
  res.json(rows);
}));

// Read one
app.get('/users/:id', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
}));

// Update
app.put('/users/:id', wrap(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const [result] = await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
  res.json({ id: Number(req.params.id), name, email });
}));

// Delete
app.delete('/users/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted successfully' });
}));

// Central error handler (the original `throw err` would crash the server)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}`)))
  .catch((e) => { console.error(e); process.exit(1); });
