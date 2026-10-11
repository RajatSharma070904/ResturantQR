# NodeDR POS tutorial

NodeDR POS is a free, open-source point-of-sale and inventory app for retail
shops. This guide covers the supported installation options and the first
workflows to complete after setup. The screenshots below are from the app.

## Choose an installation method

- **Windows 10/11:** install [NodeDR POS from the Microsoft Store](https://apps.microsoft.com/store/detail/9N4D0GW2XZ37?cid=DevShareMCLPCS).
- **CasaOS or ZimaOS:** follow the [CasaOS installation guide](casaos/README.md).
- **Windows, macOS, Linux, NAS, or VPS:** install Docker and Docker Compose,
  then run:

  ```sh
  git clone https://github.com/Raktim94/nodedr-pos.git
  cd nodedr-pos
  docker compose up -d --build
  ```

Open <http://localhost:1994> on the host computer. To use another device on
the same network, open `http://<host-ip>:1994` in its browser. On a VPS, put
HTTPS in front of the app before exposing it publicly; see the
[deployment documentation](README.md#where-to-run-it).

## First launch and shop setup

Create the administrator account, enter the shop name and address, and choose
the currency and tax settings. The dashboard is the starting point for daily
sales, stock alerts, and reports.

![NodeDR POS dashboard showing sales, revenue trend, inventory alerts, and online orders](docs/screenshots/dashboard.png)

## Add products and inventory

Open **Inventory** to add products by typing or scanning a barcode. Add the
product name, selling price, stock quantity, tax rate, and optional SKU. You
can import a larger catalogue from CSV or Excel. If an item has no barcode,
use the built-in generator or print a QR label.

![NodeDR POS inventory list with product quantities and bulk actions](docs/screenshots/inventory.png)

![NodeDR POS add-product form with barcode scan and generate options](docs/screenshots/add-product.png)

The product details and feature settings can be reviewed before you start
selling.

![NodeDR POS product and feature configuration](docs/screenshots/features.png)

## Ring up a sale

Open **POS Checkout**. Scan a product barcode, scan again to add another unit,
or search by name. Review the cart, choose cash, UPI, or card, and complete the
sale. Print a receipt, download it, or use a supported ESC/POS printer. A
weighted item can be entered by quantity or weight.

![NodeDR POS checkout with cart, a weighed item, and a UPI payment QR](docs/screenshots/pos.png)

For products tracked by serial or IMEI, enable that option in settings. The
app asks for the unit identifier during checkout.

![Optional IMEI capture during a NodeDR POS sale](docs/screenshots/product-imei.png)

![NodeDR POS checkout prompting for the IMEI of each unit](docs/screenshots/imei-sale.png)

## Follow orders and review performance

If online ordering is connected, manage new, packing, ready, and collected
orders from the order board. For sales history and store performance, use
**Reports** to review revenue, margins, categories, and time trends. Export
sales history as CSV when needed.

![NodeDR POS online order board with New, Packing, Ready, and Collected columns](docs/screenshots/orders.png)

![NodeDR POS reports with revenue, margin, category breakdown, and hourly trends](docs/screenshots/reports.png)

## Print invoices and check warranty

Configure the bill layout and shop signature in **Settings → Invoice &
signature**. The app can print a receipt or create an A4 invoice with tax and
warranty details.

![NodeDR POS A4 tax invoice with tax breakdown and warranty table](docs/screenshots/invoice-a4.png)

When IMEI or serial tracking is enabled, open **Warranty** and scan an
identifier to see the original sale date and remaining warranty period.

![NodeDR POS warranty lookup showing sale date and warranty status](docs/screenshots/warranty.png)

## Keep data safe and update

For Docker Compose and CasaOS installations, app data is stored in a persistent
Docker volume. Back it up regularly. To update a Compose installation, run
`docker compose pull && docker compose up -d`; the app's in-product updater is
also available when a new version is published. Your data volume is retained.

For more detailed installation and hardware guidance, see the
[README](README.md) and [hardware setup guide](README.md#hardware-setup).

## All screenshots

The images in this tutorial are also available under [`docs/screenshots/`](docs/screenshots/).
