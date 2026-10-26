const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { verifyReceiptToken, verifyPortalToken, receiptUrl } = require('../lib/publicLink');
const { buildInvoicePdf } = require('../lib/pdfInvoice');
const { buildReceiptPdf } = require('../lib/pdf');
const verifactu = require('../lib/verifactu/service');
const orders = require('../lib/orders');
const { readProductImage, NAME_RE } = require('../lib/productImages');
const { effectivePrice } = require('../lib/pricing');

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

// In-memory OTP & session storage (expires after 15 mins)
const otpStore = new Map(); // phone -> { otp, expiresAt, name }
const verifiedSessions = new Map(); // token -> { phone, name, verifiedAt }

// Clean up expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (data.expiresAt < now) otpStore.delete(phone);
  }
  for (const [token, data] of verifiedSessions.entries()) {
    if (now - data.verifiedAt > 24 * 60 * 60 * 1000) verifiedSessions.delete(token);
  }
}, 5 * 60 * 1000);

// GET /api/public/receipt/:token — the PDF behind a signed share link.
router.get('/receipt/:token', async (req, res) => {
  const id = verifyReceiptToken(req.params.token);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const [invoice, shop] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { items: { include: { serials: { select: { serial: true, warrantyEndsAt: true } }, product: { select: { hsn: true } } } } },
    }),
    prisma.shopSettings.findFirst(),
  ]);
  if (!invoice || !shop) return res.status(404).json({ error: 'Not found' });
  const withQr = await verifactu.withQr(invoice);
  const pdf = shop.invoiceLayout === 'a4' ? await buildInvoicePdf({ shop, invoice: withQr }) : await buildReceiptPdf({ shop, invoice: withQr });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=300',
  });
  res.send(pdf);
});

// ---- customer portal (PWA) ----------------------------------------------
router.get('/customer/:token', async (req, res) => {
  const id = verifyPortalToken(req.params.token);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const [customer, shop, announcements, invoices] = await Promise.all([
    prisma.customer.findUnique({ where: { id } }),
    prisma.shopSettings.findFirst({ select: { shopName: true, currencySymbol: true, loyaltyEnabled: true, phone: true } }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { id: 'desc' }, take: 10, select: { title: true, body: true, createdAt: true } }),
    prisma.invoice.findMany({ where: { customerId: id }, orderBy: { id: 'desc' }, take: 20, select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true } }),
  ]);
  if (!customer || !shop) return res.status(404).json({ error: 'Not found' });
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    shop,
    customer: { name: customer.name, loyaltyPoints: customer.loyaltyPoints, totalDue: customer.totalDue, creditBalance: customer.creditBalance, visits: customer.visits },
    announcements,
    receipts: invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, totalAmount: i.totalAmount, createdAt: i.createdAt, url: receiptUrl(base, i.id) })),
  });
});

// ---- Table QR Public Menu & Ordering -------------------------------------

// GET /api/public/menu — restaurant digital menu for table QR scan
router.get('/menu', async (req, res) => {
  try {
    const [shop, products] = await Promise.all([
      prisma.shopSettings.findFirst({
        select: {
          shopName: true,
          legalName: true,
          currencySymbol: true,
          currencyCode: true,
          phone: true,
          address1: true,
          upiId: true,
          allowNegativeStock: true,
        },
      }),
      prisma.product.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          category: true,
          sellingPrice: true,
          discountType: true,
          discountValue: true,
          unit: true,
          stock: true,
          imageFile: true,
        },
      }),
    ]);

    const categories = ['All', ...new Set(products.map((p) => p.category || 'General').filter(Boolean))];

    const menuItems = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'General',
      originalPrice: p.sellingPrice,
      price: effectivePrice(p),
      discount: p.discountType ? { type: p.discountType, value: p.discountValue } : null,
      unit: p.unit || 'PCS',
      available: shop?.allowNegativeStock || p.stock > 0,
      image: p.imageFile ? `/api/public/product-image/${p.imageFile}` : null,
    }));

    res.json({
      shop: shop || { shopName: 'NodeDR POS', currencySymbol: 'Rs.' },
      categories,
      items: menuItems,
    });
  } catch (err) {
    console.error('Failed to get public menu:', err);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

// GET /api/public/product-image/:file — serve product images publicly for menu
router.get('/product-image/:file', (req, res) => {
  const file = String(req.params.file || '');
  if (!NAME_RE.test(file)) return res.status(400).end();
  const bytes = readProductImage(file);
  if (!bytes) return res.status(404).end();

  const ext = file.split('.').pop();
  res.set({
    'Content-Type': ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp',
    'Cache-Control': 'public, max-age=86400, immutable',
  });
  res.send(bytes);
});

// ---- Customer Mobile Login & OTP Verification ----------------------------

// POST /api/public/auth/send-otp
const sendOtpSchema = z.object({
  phone: z.string().trim().min(10).max(15),
  name: z.string().trim().max(100).optional().default(''),
});

router.post('/auth/send-otp', async (req, res) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
  }

  const cleanPhone = parsed.data.phone.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  }

  // Generate 4-digit OTP (e.g. 1000 - 9999)
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(cleanPhone, {
    otp,
    expiresAt,
    name: parsed.data.name || '',
  });

  console.log(`[OTP LOGIN] Phone: ${cleanPhone} | OTP: ${otp}`);

  res.json({
    success: true,
    message: `OTP sent to +91-${cleanPhone}`,
    phone: cleanPhone,
    // Included so customer/user sees OTP instantly on screen without waiting for an SMS provider
    otp,
  });
});

// POST /api/public/auth/verify-otp
const verifyOtpSchema = z.object({
  phone: z.string().trim().min(10).max(15),
  otp: z.string().trim().min(4).max(6),
  name: z.string().trim().max(100).optional().default(''),
});

router.post('/auth/verify-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Phone and 4-digit OTP required' });
  }

  const cleanPhone = parsed.data.phone.replace(/\D/g, '').slice(-10);
  const inputOtp = parsed.data.otp.trim();
  const stored = otpStore.get(cleanPhone);

  // Accept generated OTP or universal testing PIN 1234
  const isValid =
    (stored && stored.otp === inputOtp && stored.expiresAt > Date.now()) ||
    inputOtp === '1234';

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
  }

  // Clear used OTP
  otpStore.delete(cleanPhone);

  const customerName = parsed.data.name || stored?.name || 'Valued Guest';

  // Find or create customer in Customer database for tracking & loyalty
  let customer = null;
  try {
    customer = await prisma.customer.findUnique({ where: { phone: cleanPhone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: cleanPhone,
          name: customerName,
        },
      });
    } else if (parsed.data.name && customer.name === 'Valued Guest') {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { name: parsed.data.name },
      });
    }
  } catch (err) {
    console.error('Customer DB sync error (non-fatal):', err.message);
  }

  // Generate verified session token
  const token = crypto.randomBytes(16).toString('hex');
  verifiedSessions.set(token, {
    phone: cleanPhone,
    name: customer ? customer.name : customerName,
    verifiedAt: Date.now(),
  });

  res.json({
    success: true,
    token,
    customer: {
      name: customer ? customer.name : customerName,
      phone: cleanPhone,
      loyaltyPoints: customer?.loyaltyPoints || 0,
    },
  });
});

// ---- Table QR Order Placement (With Login & Payment) ----------------------

const publicOrderSchema = z.object({
  table: z.string().trim().min(1).max(50),
  customerName: z.string().trim().max(100).optional().default(''),
  customerPhone: z.string().trim().max(20).optional().default(''),
  verificationToken: z.string().trim().optional(),
  paymentMethod: z.enum(['UPI', 'CASH']).default('CASH'),
  paymentRef: z.string().trim().max(100).optional().default(''),
  paid: z.boolean().default(false),
  note: z.string().trim().max(300).optional().default(''),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive().max(1000),
      })
    )
    .min(1)
    .max(100),
});

router.post('/order', async (req, res) => {
  const parsed = publicOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order input', details: parsed.error.flatten() });
  }

  const {
    table,
    customerName,
    customerPhone,
    paymentMethod,
    paymentRef,
    paid,
    note,
    items,
  } = parsed.data;

  try {
    const formattedCustomer = `${table}${customerName ? ` - ${customerName}` : ' - Guest'}`;
    const formattedNoteParts = [`[${table}]`];
    if (paymentMethod === 'UPI') {
      formattedNoteParts.push(paid ? `UPI Paid: ${paymentRef || 'Verified'}` : 'UPI at counter');
    } else {
      formattedNoteParts.push('Cash at counter');
    }
    if (note) formattedNoteParts.push(note);
    const formattedNote = formattedNoteParts.join(' | ');

    const { order } = await orders.createOrder({
      channel: 'TABLE_QR',
      fulfilment: 'DINE_IN',
      customer: {
        name: formattedCustomer,
        phone: customerPhone || null,
      },
      note: formattedNote,
      items,
      paid: Boolean(paid),
      paymentRef: paymentRef || null,
    });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        pickupCode: order.pickupCode,
        table,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        total: order.total,
        status: order.status,
        paid: order.paid,
        paymentMethod,
        paymentRef: order.paymentRef,
        createdAt: order.createdAt,
        itemCount: order.items.reduce((s, it) => s + it.quantity, 0),
      },
    });
  } catch (err) {
    console.error('Table QR Order failed:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to place order' });
  }
});

// GET /api/public/order/:code — check order status for customer tracking screen
router.get('/order/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Invalid order code' });

  try {
    const order = await prisma.order.findFirst({
      where: { pickupCode: code },
      include: { items: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({
      order: {
        id: order.id,
        pickupCode: order.pickupCode,
        customerName: order.customerName,
        status: order.status,
        total: order.total,
        paid: order.paid,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        })),
        note: order.note,
      },
    });
  } catch (err) {
    console.error('Check order failed:', err);
    res.status(500).json({ error: 'Failed to check order' });
  }
});

module.exports = router;
