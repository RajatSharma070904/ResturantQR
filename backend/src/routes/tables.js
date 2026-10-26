const express = require('express');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requirePerm } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const TABLES_FILE = path.join(__dirname, '..', '..', 'data', 'tables.json');

const DEFAULT_TABLES = [
  'Table 1',
  'Table 2',
  'Table 3',
  'Table 4',
  'Table 5',
  'Table 6',
  'Table 7',
  'Table 8',
];

function getStoredTables() {
  try {
    if (fs.existsSync(TABLES_FILE)) {
      const content = fs.readFileSync(TABLES_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading tables.json:', err.message);
  }
  return DEFAULT_TABLES;
}

function saveStoredTables(tables) {
  fs.mkdirSync(path.dirname(TABLES_FILE), { recursive: true });
  fs.writeFileSync(TABLES_FILE, JSON.stringify(tables, null, 2), 'utf8');
}

// GET /api/tables - returns tables with their current active order status
router.get('/', async (req, res) => {
  try {
    const tableNames = getStoredTables();

    // Fetch active open orders (NEW, PACKING, READY)
    const openOrders = await prisma.order.findMany({
      where: {
        status: { in: ['NEW', 'PACKING', 'READY'] },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const tables = tableNames.map((name, index) => {
      // Find orders matching this table name in customerName or note
      const nameLower = name.toLowerCase().trim();
      const active = openOrders.filter((o) => {
        const cLower = (o.customerName || '').toLowerCase();
        const nLower = (o.note || '').toLowerCase();
        return cLower.includes(nameLower) || nLower.includes(nameLower);
      });

      return {
        id: `T${index + 1}`,
        name,
        activeOrders: active.map((o) => ({
          id: o.id,
          pickupCode: o.pickupCode,
          customerName: o.customerName,
          status: o.status,
          total: o.total,
          itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
          items: o.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
          createdAt: o.createdAt,
          note: o.note,
        })),
      };
    });

    res.json({
      tables,
      totalTables: tables.length,
      occupiedCount: tables.filter((t) => t.activeOrders.length > 0).length,
    });
  } catch (err) {
    console.error('Failed to get tables:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/tables - update configured tables (Admin only)
router.post('/', requirePerm('orders'), async (req, res) => {
  try {
    const schema = z.object({
      tables: z.array(z.string().trim().min(1).max(50)).min(1).max(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid tables list', details: parsed.error.flatten() });
    }

    // Deduplicate names
    const cleanTables = [...new Set(parsed.data.tables.map((t) => t.trim()))];
    saveStoredTables(cleanTables);

    res.json({ success: true, tables: cleanTables });
  } catch (err) {
    console.error('Failed to save tables:', err);
    res.status(500).json({ error: 'Failed to save tables' });
  }
});

module.exports = router;
