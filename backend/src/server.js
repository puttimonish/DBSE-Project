require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const uploadDir = path.resolve(__dirname, '../../uploads');

fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|pdf)$/i.test(file.originalname);
    cb(allowed ? null : new Error('Only JPG, JPEG, PNG and PDF files are allowed'), allowed);
  }
});

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new Error('Missing bearer token');
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

function role(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'pharmaflow-api', database: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'degraded', service: 'pharmaflow-api', database: 'unavailable' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (name.length > 100 || email.length > 160 || password.length < 6) {
      return res.status(400).json({ error: 'Please provide valid account details' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [r] = await pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES(?,?,?)',
      [name, email, hash]
    );
    res.status(201).json({ id: r.insertId, name, email, role: 'CUSTOMER' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    console.error('Registration error:', e.message);
    res.status(500).json({ error: 'Unable to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
    const account = rows[0];
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = { id: account.id, name: account.name, email: account.email, role: account.role };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Unable to sign in' });
  }
});

app.get('/api/medicines', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    const cat = String(req.query.category || '');
    const params = [`%${q}%`, `%${q}%`, `%${q}%`];
    let sql = `
      SELECT m.*, c.name AS category
      FROM medicines m
      LEFT JOIN categories c ON c.id=m.category_id
      WHERE m.active=1
        AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ?)
    `;
    if (cat) {
      sql += ' AND c.name=?';
      params.push(cat);
    }
    sql += ' ORDER BY m.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('Medicine catalog error:', e.message);
    res.status(500).json({ error: 'Unable to load medicines' });
  }
});

app.get('/api/medicines/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category
       FROM medicines m LEFT JOIN categories c ON c.id=m.category_id
       WHERE m.id=? AND m.active=1`,
      [req.params.id]
    );
    rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Medicine not found' });
  } catch (e) {
    res.status(500).json({ error: 'Unable to load medicine' });
  }
});

app.post('/api/prescriptions', auth, upload.single('prescription'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Prescription file required' });

  let prescriptionId;
  try {
    const [r] = await pool.query(
      'INSERT INTO prescriptions(user_id,file_name,file_path,status) VALUES(?,?,?,?)',
      [req.user.id, req.file.originalname, req.file.path, 'PENDING']
    );
    prescriptionId = r.insertId;
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('Prescription insert error:', e.message);
    return res.status(500).json({ error: 'Unable to save prescription' });
  }

  let ocr = {
    text: 'OCR extraction pending',
    confidence: 0,
    engine: 'OCR unavailable'
  };

  try {
    const form = new FormData();
    const fileBuffer = fs.readFileSync(req.file.path);
    form.append('file', new Blob([fileBuffer], { type: req.file.mimetype }), req.file.originalname);

    const ocrUrl = String(process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
    const resp = await fetch(`${ocrUrl}/extract`, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(`OCR service returned HTTP ${resp.status}`);

    ocr = await resp.json();
    await pool.query(
      'UPDATE prescriptions SET ocr_text=?,status=? WHERE id=?',
      [ocr.text || '', 'OCR_REVIEW', prescriptionId]
    );
  } catch (e) {
    console.error('OCR processing failed:', e.message);
    await pool.query(
      'UPDATE prescriptions SET ocr_text=?,status=? WHERE id=?',
      ['OCR processing failed. Manual pharmacist review required.', 'PENDING', prescriptionId]
    );
  }

  res.status(201).json({
    id: prescriptionId,
    fileName: req.file.originalname,
    status: ocr.engine === 'Tesseract OCR' ? 'OCR_REVIEW' : 'PENDING',
    ocr
  });
});

app.get('/api/prescriptions', auth, async (req, res) => {
  try {
    const staff = ['ADMIN', 'PHARMACIST'].includes(req.user.role);
    const sql = `
      SELECT p.id,p.user_id,p.file_name,p.ocr_text,p.status,p.pharmacist_note,p.created_at,p.verified_at,
             u.name AS customer
      FROM prescriptions p
      JOIN users u ON u.id=p.user_id
      ${staff ? '' : 'WHERE p.user_id=?'}
      ORDER BY p.created_at DESC
    `;
    const [rows] = await pool.query(sql, staff ? [] : [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load prescriptions' });
  }
});

app.get('/api/prescriptions/:id/file', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id,file_name,file_path FROM prescriptions WHERE id=? LIMIT 1',
      [req.params.id]
    );
    const p = rows[0];
    if (!p) return res.status(404).json({ error: 'Prescription not found' });

    const staff = ['ADMIN', 'PHARMACIST'].includes(req.user.role);
    if (!staff && Number(p.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.resolve(p.file_path || '');
    const root = uploadDir.endsWith(path.sep) ? uploadDir : uploadDir + path.sep;
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Prescription file unavailable' });
    }

    res.setHeader('Content-Disposition', `inline; filename="${path.basename(p.file_name).replace(/"/g, '')}"`);
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ error: 'Unable to open prescription file' });
  }
});

app.patch('/api/prescriptions/:id/verify', auth, role('PHARMACIST', 'ADMIN'), async (req, res) => {
  const status = String(req.body?.status || '');
  const note = String(req.body?.note || '').trim();
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [existing] = await pool.query('SELECT id,status FROM prescriptions WHERE id=? LIMIT 1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Prescription not found' });
    if (['APPROVED', 'REJECTED'].includes(existing[0].status)) {
      return res.status(409).json({ error: `Prescription is already ${existing[0].status.toLowerCase()}` });
    }

    await pool.query(
      'UPDATE prescriptions SET status=?,pharmacist_note=?,verified_at=NOW() WHERE id=?',
      [status, note || `Reviewed by ${req.user.name}`, req.params.id]
    );
    res.json({ message: `Prescription ${status.toLowerCase()}` });
  } catch (e) {
    console.error('Prescription verification error:', e.message);
    res.status(500).json({ error: 'Unable to update prescription' });
  }
});

app.post('/api/orders', auth, async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const address = String(req.body?.address || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || 'COD').toUpperCase();
  const prescriptionId = req.body?.prescriptionId == null ? null : Number(req.body.prescriptionId);

  if (!rawItems.length || !address) return res.status(400).json({ error: 'Items and delivery address are required' });
  if (paymentMethod !== 'COD') return res.status(400).json({ error: 'Only Cash on Delivery is currently enabled' });
  if (prescriptionId !== null && !isPositiveInteger(prescriptionId)) return res.status(400).json({ error: 'Invalid prescription ID' });

  const itemsMap = new Map();
  for (const item of rawItems) {
    const medicineId = Number(item?.medicineId);
    const quantity = Number(item?.quantity);
    if (!isPositiveInteger(medicineId) || !isPositiveInteger(quantity)) {
      return res.status(400).json({ error: 'Each medicine must have a positive integer quantity' });
    }
    itemsMap.set(medicineId, (itemsMap.get(medicineId) || 0) + quantity);
  }
  const items = [...itemsMap.entries()].map(([medicineId, quantity]) => ({ medicineId, quantity }));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    let requiresPrescription = false;
    const lockedMedicines = [];

    for (const item of items) {
      const [rows] = await conn.query(
        'SELECT id,price,stock,prescription_required FROM medicines WHERE id=? AND active=1 FOR UPDATE',
        [item.medicineId]
      );
      const medicine = rows[0];
      if (!medicine) throw new Error(`Medicine ${item.medicineId} is unavailable`);
      if (medicine.stock < item.quantity) throw new Error(`Insufficient stock for medicine ${item.medicineId}`);

      if (Boolean(medicine.prescription_required)) requiresPrescription = true;
      total += Number(medicine.price) * item.quantity;
      lockedMedicines.push({ ...item, price: medicine.price });
    }

    if (requiresPrescription) {
      if (!prescriptionId) throw new Error('An approved prescription is required for one or more medicines');
      const [p] = await conn.query(
        'SELECT id,status FROM prescriptions WHERE id=? AND user_id=? LIMIT 1',
        [prescriptionId, req.user.id]
      );
      if (p[0]?.status !== 'APPROVED') throw new Error('Prescription must be approved before checkout');
    } else if (prescriptionId) {
      throw new Error('Prescription ID is not needed for this order');
    }

    const [order] = await conn.query(
      'INSERT INTO orders(user_id,prescription_id,total,address,payment_status,status) VALUES(?,?,?,?,?,?)',
      [req.user.id, prescriptionId, total, address, 'COD', 'CONFIRMED']
    );

    for (const item of lockedMedicines) {
      await conn.query(
        'INSERT INTO order_items(order_id,medicine_id,quantity,unit_price) VALUES(?,?,?,?)',
        [order.insertId, item.medicineId, item.quantity, item.price]
      );
      await conn.query('UPDATE medicines SET stock=stock-? WHERE id=?', [item.quantity, item.medicineId]);
    }

    await conn.commit();
    res.status(201).json({ orderId: order.insertId, total, status: 'CONFIRMED', paymentStatus: 'COD' });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message || 'Unable to create order' });
  } finally {
    conn.release();
  }
});

app.get('/api/orders', auth, async (req, res) => {
  try {
    const staff = ['ADMIN', 'PHARMACIST'].includes(req.user.role);
    const [rows] = await pool.query(
      `SELECT o.*,u.name AS customer FROM orders o JOIN users u ON u.id=o.user_id
       ${staff ? '' : 'WHERE o.user_id=?'} ORDER BY o.created_at DESC`,
      staff ? [] : [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load orders' });
  }
});

app.get('/api/dashboard', auth, role('ADMIN', 'PHARMACIST'), async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM medicines WHERE active=1) AS medicines,
        (SELECT COUNT(*) FROM prescriptions WHERE status IN ('PENDING','OCR_REVIEW')) AS pending_prescriptions,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at)=CURDATE()) AS today_orders,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status IN ('PAID','COD')) AS gross_sales
    `);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load dashboard' });
  }
});

const swagger = {
  openapi: '3.0.0',
  info: { title: 'PharmaFlow API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:5000' }],
  paths: {
    '/api/health': { get: { summary: 'Health check' } },
    '/api/medicines': { get: { summary: 'Medicine catalog' } },
    '/api/auth/login': { post: { summary: 'JWT login' } },
    '/api/prescriptions': { post: { summary: 'Upload prescription' }, get: { summary: 'List prescriptions' } },
    '/api/orders': { post: { summary: 'Create order' }, get: { summary: 'List orders' } }
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swagger));

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File must be 5 MB or smaller' });
    return res.status(400).json({ error: 'Invalid upload' });
  }
  if (err.message?.includes('Only JPG')) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
