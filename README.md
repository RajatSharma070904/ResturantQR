<p align="center">
  <h1 align="center">🍽️ ResturantQR</h1>
  <p align="center">
    <strong>Self-Hosted Restaurant POS, Table QR Dine-in Ordering, Customer Mobile OTP Login & Live UPI Payments</strong>
  </p>
  <p align="center">
    <em>Created with ❤️ by <strong><a href="https://github.com/RajatSharma070904">Rajat Sharma</a></strong></em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Next.js-16.4-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Database-SQLite%20via%20Prisma-2D3748?logo=prisma" alt="Database">
  <img src="https://img.shields.io/badge/Payments-UPI%20%2B%20Cash%20%2B%20Card-4CAF50" alt="Payments">
  <img src="https://img.shields.io/badge/Offline--First-100%25-success" alt="Offline First">
</p>

---

## 🌟 Overview

**ResturantQR** is a modern, high-performance, **offline-first Restaurant Point of Sale (POS) & Table QR Ordering System** designed for restaurants, cafes, food trucks, bars, and dhabas. 

It empowers dining venues to offer a contactless **"Scan to Order"** experience (similar to Petpooja and premium dining apps) directly on their local network without paying recurring SaaS subscription fees or per-transaction platform commissions.

---

## 🚀 Key Features

### 1. 🍽️ Table-Wise QR Dine-in Ordering (Scan to Order)
* **Branded Table Standees:** Automatically generate high-resolution QR standees and stickers for every table (Table 1, Table 2, Patio, Rooftop, etc.).
* **One-Click Printing:** Print individual table QRs or batch-print all table standees in one go on thermal or card-stock paper.
* **Instant Mobile Menu:** Guests scan the QR using their smartphone camera (iPhone / Android) without needing to download any app.

### 2. 📱 Customer Mobile Login with OTP Verification
* **Customer Verification:** Guests log in with their 10-digit mobile number before confirming their order.
* **Instant 4-Digit OTP:** High-speed verification with automatic demo OTP support (`1234` or generated PIN) for frictionless dining.
* **Loyalty & CRM Integration:** Verified phone numbers are automatically linked to customer records in the POS database, tracking dining frequency, total spend, and loyalty points.

### 3. 💳 Integrated Payments (Instant UPI QR + Counter Cash)
* **Live Dynamic UPI QR:** Generates NPCI-compliant UPI QR codes embedding the restaurant's merchant UPI ID, exact bill amount, and order reference.
* **Mobile Deep-Linking:** Guests can tap **"Open GPay / PhonePe / Paytm / BHIM"** on their phone to complete payment in one tap.
* **Pay at Counter Mode:** Option for guests to order now and settle via Cash, Card, or UPI at the cashier counter after finishing their meal.

### 4. 🍳 Real-Time Kitchen Orders Board (KOT)
* Live Kanban board with columns:
  * **NEW:** Incoming orders received from table QR scans.
  * **PACKING / IN KITCHEN:** Chefs and kitchen crew view dishes and special cooking instructions (e.g., *"Less spicy, extra butter"*).
  * **READY:** Food prepared and ready to serve at the specific table.
  * **COLLECTED & BILLED:** Handed over and settled.

### 5. 🟢 Live Table Floor Management View
* Real-time floor plan showing visual status of all dining areas:
  * 🟢 **Vacant:** Table is empty and ready for new guests.
  * 🟡 **Occupied / Dining:** Live table card displaying active token (`#ABC12`), ordered items, order total, and elapsed time.
  * 🔵 **Ready to Serve:** Table dishes are ready for waitstaff.

### 6. 🧾 GST Billing & Dual Invoice Printing
* **India GST Ready:** Full support for HSN/SAC codes, MRP-inclusive or exclusive tax calculations, and CGST/SGST breakdowns.
* **Dual Layout:** Fast 80mm/58mm thermal receipts (ESC/POS) + A4 Tax Invoices with authorised signature integration.

---

## 🛠️ Architecture & Tech Stack

```
                     ┌───────────────────────────────────┐
                     │       Customer Mobile Device      │
                     │ (Scan QR ➔ Menu ➔ OTP ➔ UPI Pay) │
                     └─────────────────┬─────────────────┘
                                       │ HTTP / LAN Wi-Fi
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          ResturantQR System                            │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Frontend (Next.js 16 + React 19)│  Backend API (Node.js + Express 5)  │
│  • App Router (Turbopack)        │  • Public Menu & Table Order APIs   │
│  • Responsive Mobile Menu        │  • OTP Verification Engine          │
│  • Table Floor Management UI     │  • Prisma ORM with Better-SQLite3   │
│  • Kitchen Orders Kanban Board   │  • Thermal ESC/POS USB Printing     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

* **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TanStack Query, Lucide Icons, QRCode.
* **Backend:** Node.js 24, Express 5, Prisma 7 ORM, Better-SQLite3, Zod validation, Helmet security.
* **Storage:** SQLite with Write-Ahead Logging (WAL) for high concurrency and zero data loss.

---

## 🏁 Quick Start (Windows)

### 1. Launch with One Click
Double click **`start-pos.bat`** in the project root folder. It will:
1. Start the Express API backend on port `4000`.
2. Start the Next.js frontend on port `1994`.
3. Automatically open **`http://localhost:1994`** in your default web browser.

---

### 2. Manual Startup

#### Backend
```bash
cd backend
npm install
npx prisma migrate deploy
npm start
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Network & Access URLs

| Section | URL | Target Audience |
|---|---|---|
| **POS Counter / Admin** | `http://localhost:1994` | Cashier & Restaurant Owner |
| **Table & Floor View** | `http://localhost:1994/tables` | Floor Manager & Captains |
| **Kitchen Orders Board** | `http://localhost:1994/orders` | Chefs & Kitchen Staff |
| **Customer Menu (Wi-Fi)** | `http://<your-ip>:1994/menu?table=Table%201` | Dining Customers |

*Refer to [**`TABLE_QR_SETUP.md`**](TABLE_QR_SETUP.md) for detailed network IP setup and printing guides.*

---

## 👨‍💻 Author

**Rajat Sharma**
* GitHub: [@RajatSharma070904](https://github.com/RajatSharma070904)
* Repository: [https://github.com/RajatSharma070904/ResturantQR](https://github.com/RajatSharma070904/ResturantQR)

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
