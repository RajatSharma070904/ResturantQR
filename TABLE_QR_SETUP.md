# 🍽️ Restaurant Table QR Ordering & Setup Guide (Petpooja Style)

Yeh guide aapko aapke **NodeDR POS** mein naye **Table QR Dine-in Ordering System** ko setup aur operate karne ki poori jankari deti hai.

---

## 📌 1. Network & IP Information (Aapke System Ka Pata)

Table QR code ko customer ke phone par chalane ke liye, customer ka phone aur POS computer aapas mein connect hone chahiye:

| Service | Access Link | Kaun Use Karega |
|---|---|---|
| **POS Dashboard (Till Machine)** | [http://localhost:1994](http://localhost:1994) | Cashier / Admin / Manager |
| **Table Management & Floor View** | [http://localhost:1994/tables](http://localhost:1994/tables) | Captain / Floor Manager / Cashier |
| **Kitchen / Counter Orders Board** | [http://localhost:1994/orders](http://localhost:1994/orders) | Chef / Kitchen Display / Counter |
| **Customer Mobile Menu (Wi-Fi)** | `http://192.168.1.2:1994/menu?table=Table%201` | Customer (Table par baithkar) |

> [!IMPORTANT]
> **Wi-Fi IP:** Is computer ka local Wi-Fi IP **`192.168.1.2`** hai (Ethernet IP: `192.168.11.25`).
> Jab customer restaurant ke Wi-Fi se connect hoga, toh woh `http://192.168.1.2:1994/menu?table=Table%201` scan karke bina internet ke bhi order kar sakega!

---

## 🖨️ 2. Har ek Table ka QR Code Kaise Banayein aur Print Karein?

Aapko kisi bahar ke software ki zaroorat nahi hai. POS ke andar hi Table QR generator built-in hai:

1. Apne browser mein POS kholein: **[http://localhost:1994](http://localhost:1994)**.
2. Left sidebar mein **"Table QR"** par click karein (ya direct jaayein [http://localhost:1994/tables](http://localhost:1994/tables)).
3. Upar aapko 3 tabs milenge:
   - **Floor View:** Live floor jahan dikhega kaun si table khali hai aur kaun si par order chal raha hai.
   - **Print Standees:** Yahan har table ka branded QR Standee Card ready rehta hai.
   - **Manage Tables:** Yahan aap naye tables add kar sakte hain (jaise *Table 9*, *Rooftop 1*, *Family Cabin A*) ya delete kar sakte hain.
4. **Print Tab** par click karein aur **"Print All Standees"** dabayein.
   - Aap individual table ka QR image download bhi kar sakte hain (Download button).
   - In QRs ko acrylic standee ya table top sticker banwa kar table par laga dein.

---

## 📱 3. Customer Order & Login Flow (Mobile OTP + Payment)

Jab koi guest aapke restaurant mein aata hai:
1. Customer table par baithega aur apne phone camera se **Table QR scan** karega.
2. Customer ke phone mein digital menu page khulega:
   - Restaurant Name (*tarki*), Contact Number, aur Table Name (*Table 1*).
   - Category wise food list (Starters, Main Course, Breads, Beverages, etc.).
   - Dishes ki photo, selling price aur discounts.
3. Customer items select karega (`+ Add` button).
4. **Step 1 - Order Cart Review:**
   - Customer selected items dekhega aur **Cooking Instructions** likhega (e.g. *"Less spicy, extra butter"*).
   - "Proceed to Login & Verify OTP" par click karega.
5. **Step 2 - Mobile Login & OTP Verification:**
   - Customer apna 10-digit mobile number aur naam daal kar **"Get OTP"** dabayega.
   - Screen par 4-digit OTP aayega (Fast testing ke liye OTP auto-fill ho jata hai, universal PIN: `1234`).
   - Customer **"Verify OTP"** dabayega.
   - Phone number verify hote hi customer ka data POS Customer Database mein save ho jayega.
6. **Step 3 - Payment Mode Selection:**
   - 💳 **Pay Now via UPI QR:**
     - Screen par live dynamic UPI QR generate hoga (GPay, PhonePe, Paytm, BHIM).
     - Customer phone se scan karke ya direct **"Open GPay/PhonePe"** dabakar payment kar sakta hai.
     - Payment hone ke baad **"I Have Paid & Place Order"** dabata hai.
   - 💵 **Pay at Counter (Cash/Card):**
     - Customer **"Place Dine-in Order (Pay Later)"** choose karke order bhej sakta hai aur khana khane ke baad counter par cash de sakta hai.
7. **Step 4 - Live Order Status Tracker:**
   - Order confirm hote hi Token Number (e.g. `#FXPZT4`) aur live status khulega:
     - ⏳ **Order Received:** Kitchen counter ne accept kiya.
     - 👨‍🍳 **Preparing Dishes:** Chef khana cook kar raha hai.
     - 🛎️ **Ready to Serve:** Khana table par serve ho raha hai.

---

## 🖥️ 4. Counter / Kitchen par Order Kaise Dikhega aur Kaise Bill Banega?

Table se aate hi order do jagah realtime mein update hota hai:

### A. Live Floor View ([/tables](http://localhost:1994/tables)):
- Table 1 ka card **Green (Vacant)** se **Yellow (Dining / Occupied)** ban jayega.
- Wahan table ka bill total, ordered items aur time dikhai dega.

### B. Kitchen / Orders Board ([/orders](http://localhost:1994/orders)):
- **NEW Column:** Naya card aayega jisme likha hoga:
  ```
  🍽️ Table 1 - Aman Sharma
  Token: #RKW4RB · Dine-in
  Items: 1x Paneer Butter Masala, 2x Butter Naan, 1x Cold Drink
  Note: [Table 1] Extra butter and crispy
  Total: Rs. 360.00
  ```
- **Cooking Shuru:** Chef card ko drag karke ya button dabakar **"Move to packing / kitchen"** kar dega.
- **Serving:** Jab khana table par serve ho jaye, use **"Move to ready"** kar dein.
- **Final Billing:** Jab customer khana kha chuke:
  - **"Hand over & bill"** button dabayein.
  - Payment method select karein (**Cash**, **UPI QR**, ya **Card**).
  - Bill submit karein — final GST tax invoice print ho jayega aur Table wapas **Vacant (Khali)** ho jayegi!

---

## 🌐 5. Mobile Data (4G/5G) se Order Lene ke Liye (Optional)

Agar aap chahte hain ki customer ko restaurant Wi-Fi se connect na hona pade aur woh apne khud ke **Jio / Airtel 4G/5G data** se QR scan karke order kare:

### Option A: Cloudflare Tunnel (Recommended & 100% Free)
1. Free Cloudflare account banayein (`cloudflare.com`).
2. Cloudflare Tunnel create karein pointing to `http://localhost:1994`.
3. Aapko ek free address mil jayega, jaise: `https://order.yourshop.com`.
4. POS ke root `.env` mein set karein:
   ```env
   PUBLIC_BASE_URL=https://order.yourshop.com
   ```
5. Ab jab aap Table QR print karenge, toh QR codes par wahi public domain aayega, jise koi bhi mobile data se bhi scan kar sakega!

### Option B: Local Restaurant Wi-Fi (No Internet Needed)
- Router par internet connection hone ki zaroorat nahi hai.
- Sirf ek Wi-Fi router shop mein laga ho jisse POS machine aur customer ka phone connect ho.

---

## 🛠️ 6. System Restart & Daily Running

Aapke desktop folder mein **`start-pos.bat`** script bani hui hai:
- Subah computer on karke sirf **`start-pos.bat`** par double click karein.
- Backend (Port 4000) aur Frontend (Port 1994) dono background mein start ho jayenge aur browser mein POS khul jayega!
