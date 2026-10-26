"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ChefHat,
  Bell,
  X,
  Phone,
  ArrowRight,
  Store,
  ShieldCheck,
  CreditCard,
  QrCode,
  KeyRound,
  Check,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface MenuItem {
  id: number;
  name: string;
  category: string;
  originalPrice: number;
  price: number;
  discount: { type: string; value: number } | null;
  unit: string;
  available: boolean;
  image: string | null;
}

interface ShopInfo {
  shopName: string;
  legalName?: string | null;
  currencySymbol: string;
  currencyCode?: string;
  phone?: string | null;
  address1?: string | null;
  upiId?: string | null;
}

interface CartItem {
  product: MenuItem;
  quantity: number;
}

interface PlacedOrderInfo {
  id: number;
  pickupCode: string;
  table: string;
  customerName: string;
  customerPhone?: string | null;
  status: string;
  total: number;
  paid: boolean;
  paymentMethod: string;
  createdAt: string;
}

type CheckoutStep = "cart" | "login" | "payment";

function MenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table") || searchParams.get("t") || "";

  const [table, setTable] = useState<string>(tableParam || "Table 1");
  const [shop, setShop] = useState<ShopInfo>({ shopName: "Restaurant Menu", currencySymbol: "Rs." });
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Checkout Step State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [step, setStep] = useState<CheckoutStep>("cart");
  const [orderNote, setOrderNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Customer Login & OTP State
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [devOtp, setDevOtp] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [otpError, setOtpError] = useState<string>("");

  // Payment State
  const [paymentMode, setPaymentMode] = useState<"UPI" | "CASH">("UPI");
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>("");
  const [upiUtr, setUpiUtr] = useState<string>("");
  const [upiUrl, setUpiUrl] = useState<string>("");

  // Active Order Tracking State
  const [activeOrder, setActiveOrder] = useState<PlacedOrderInfo | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState<boolean>(false);

  // Load menu data
  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const res = await fetch("/api/public/menu");
        if (!res.ok) throw new Error("Could not load digital menu");
        const data = await res.json();
        setShop(data.shop || { shopName: "Restaurant Menu", currencySymbol: "Rs." });
        setCategories(data.categories || ["All"]);
        setItems(data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load menu");
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, []);

  // Update table if query param changes
  useEffect(() => {
    if (tableParam) {
      setTable(tableParam);
    }
  }, [tableParam]);

  // Load verified session & active order from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("nodedr_customer_name");
      const savedPhone = localStorage.getItem("nodedr_customer_phone");
      const savedToken = localStorage.getItem("nodedr_customer_token");
      const savedOrder = localStorage.getItem("nodedr_active_order");
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedToken) {
        setVerificationToken(savedToken);
        setIsVerified(true);
      }
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        setActiveOrder(parsed);
      }
    } catch {}
  }, []);

  // Poll active order status
  useEffect(() => {
    if (!activeOrder?.pickupCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/order/${activeOrder.pickupCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.order) {
            setActiveOrder((prev) =>
              prev ? { ...prev, status: data.order.status, paid: data.order.paid } : null
            );
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeOrder?.pickupCode]);

  // Cart operations
  const addToCart = (product: MenuItem) => {
    setCart((prev) => {
      const existing = prev[product.id];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [product.id]: { product, quantity: newQty },
      };
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const cartList = useMemo(() => Object.values(cart), [cart]);
  const cartItemCount = useMemo(() => cartList.reduce((s, it) => s + it.quantity, 0), [cartList]);
  const cartTotal = useMemo(
    () => cartList.reduce((s, it) => s + it.product.price * it.quantity, 0),
    [cartList]
  );

  // Generate UPI QR whenever cartTotal or shop upiId changes
  useEffect(() => {
    if (cartTotal <= 0) return;
    const vpa = shop.upiId || (shop.phone ? `${shop.phone.replace(/\D/g, "")}@upi` : "merchant@upi");
    const merchantName = encodeURIComponent(shop.shopName || "Restaurant");
    const uri = `upi://pay?pa=${vpa}&pn=${merchantName}&am=${cartTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `${table} Order`
    )}`;
    setUpiUrl(uri);

    QRCode.toDataURL(uri, {
      width: 280,
      margin: 1,
      color: { dark: "#064e3b", light: "#ffffff" },
    })
      .then((url) => setUpiQrDataUrl(url))
      .catch((err) => console.error("UPI QR generation failed:", err));
  }, [cartTotal, shop.upiId, shop.phone, shop.shopName, table]);

  // Filtered products
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Send OTP handler
  const handleSendOtp = async () => {
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setOtpError("Please enter a valid 10-digit mobile number");
      return;
    }
    setOtpError("");
    try {
      setSendingOtp(true);
      const res = await fetch("/api/public/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, name: customerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setOtpSent(true);
      setDevOtp(data.otp || "1234");
      // Auto-fill OTP in demo mode for instant seamless testing
      setOtp(data.otp || "1234");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setOtpError("Please enter the 4-digit OTP");
      return;
    }
    setOtpError("");
    try {
      setVerifyingOtp(true);
      const res = await fetch("/api/public/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customerPhone,
          otp: otp.trim(),
          name: customerName.trim() || "Guest",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");

      setIsVerified(true);
      setVerificationToken(data.token);
      localStorage.setItem("nodedr_customer_phone", customerPhone);
      if (data.customer?.name) {
        setCustomerName(data.customer.name);
        localStorage.setItem("nodedr_customer_name", data.customer.name);
      }
      localStorage.setItem("nodedr_customer_token", data.token);

      // Advance directly to Payment Step!
      setStep("payment");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Switch customer / logout phone
  const handleResetVerification = () => {
    setIsVerified(false);
    setOtpSent(false);
    setOtp("");
    setVerificationToken("");
    localStorage.removeItem("nodedr_customer_token");
  };

  // Place final order
  const handleConfirmOrder = async () => {
    if (cartList.length === 0) return;
    try {
      setSubmitting(true);

      const isUpiPaid = paymentMode === "UPI";
      const payload = {
        table: table || "Table 1",
        customerName: customerName.trim() || "Guest",
        customerPhone: customerPhone.trim(),
        verificationToken,
        paymentMethod: paymentMode,
        paymentRef: isUpiPaid ? (upiUtr.trim() ? `UTR: ${upiUtr.trim()}` : "UPI Verified") : "",
        paid: isUpiPaid,
        note: orderNote.trim(),
        items: cartList.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
        })),
      };

      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      const orderInfo: PlacedOrderInfo = {
        id: data.order.id,
        pickupCode: data.order.pickupCode,
        table: data.order.table,
        customerName: data.order.customerName,
        customerPhone: data.order.customerPhone,
        status: data.order.status,
        total: data.order.total,
        paid: data.order.paid,
        paymentMethod: data.order.paymentMethod,
        createdAt: data.order.createdAt,
      };

      setActiveOrder(orderInfo);
      localStorage.setItem("nodedr_active_order", JSON.stringify(orderInfo));
      setCart({});
      setIsModalOpen(false);
      setStep("cart");
      setOrderNote("");
      setIsTrackingOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error placing order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-zinc-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Opening Digital Menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-zinc-950">
        <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <UtensilsCrossed className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Menu Unavailable</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-28 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                {shop.shopName}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {shop.phone ? `Ph: ${shop.phone}` : "Dine-in Menu"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-300">
              <Store className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{table}</span>
            </div>

            {isVerified && (
              <span
                className="hidden items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex"
                title={`Logged in as ${customerPhone}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {customerName || "Verified"}
              </span>
            )}

            {activeOrder && (
              <button
                onClick={() => setIsTrackingOpen(true)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
                title="View active order"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, items..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-100/70 py-2 pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100 dark:focus:bg-zinc-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="no-scrollbar mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-2.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Main Dishes List */}
      <main className="mx-auto max-w-2xl px-4 pt-4">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-800">
            <UtensilsCrossed className="mx-auto h-8 w-8 text-zinc-400" />
            <h3 className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">No dishes found</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {items.length === 0
                ? "No products added in the POS inventory yet."
                : "Try searching with a different name or category."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const inCart = cart[item.id];
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-sm transition hover:shadow dark:border-zinc-800/80 dark:bg-zinc-900"
                >
                  <div className="flex gap-3">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-18 w-18 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <UtensilsCrossed className="h-6 w-6" />
                      </div>
                    )}

                    <div className="flex-1">
                      <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {item.category}
                      </span>
                      <h4 className="mt-0.5 font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {shop.currencySymbol}
                          {item.price.toFixed(2)}
                        </span>
                        {item.discount && (
                          <span className="text-xs text-zinc-400 line-through">
                            {shop.currencySymbol}
                            {item.originalPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-400">/ {item.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end border-t border-zinc-100 pt-2.5 dark:border-zinc-800/60">
                    {qty === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        disabled={!item.available}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-emerald-200/60 active:scale-90 dark:hover:bg-emerald-900/60"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{qty}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-emerald-200/60 active:scale-90 dark:hover:bg-emerald-900/60"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between rounded-2xl bg-zinc-900 p-3.5 text-white shadow-2xl ring-1 ring-white/10 dark:bg-emerald-950 dark:text-white dark:ring-emerald-500/30">
            <div>
              <p className="text-xs text-zinc-400 dark:text-emerald-200/70">
                {cartItemCount} item{cartItemCount > 1 ? "s" : ""} · {table}
              </p>
              <p className="text-base font-bold leading-tight">
                Total: {shop.currencySymbol}
                {cartTotal.toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => {
                setStep("cart");
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" /> View Cart
            </button>
          </div>
        </div>
      )}

      {/* Complete Multi-Step Checkout Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {step === "cart" ? "1" : step === "login" ? "2" : "3"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {step === "cart"
                      ? "Review Your Order"
                      : step === "login"
                      ? "Mobile Login & OTP Verification"
                      : "Choose Payment Mode"}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {step === "cart" ? `Dine-in at ${table}` : step === "login" ? "Verify your phone to place order" : `Pay for ${table}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Progress Indicators */}
            <div className="my-3 flex items-center justify-between text-xs">
              <button
                onClick={() => setStep("cart")}
                className={`flex-1 text-center border-b-2 pb-1.5 font-semibold transition ${
                  step === "cart"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400"
                }`}
              >
                1. Order Cart
              </button>
              <button
                onClick={() => (cartList.length > 0 ? setStep("login") : null)}
                className={`flex-1 text-center border-b-2 pb-1.5 font-semibold transition ${
                  step === "login"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400"
                }`}
              >
                2. Mobile OTP
              </button>
              <button
                onClick={() => (isVerified ? setStep("payment") : null)}
                className={`flex-1 text-center border-b-2 pb-1.5 font-semibold transition ${
                  step === "payment"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400"
                }`}
              >
                3. Payment
              </button>
            </div>

            {/* STEP 1: CART REVIEW */}
            {step === "cart" && (
              <div>
                <div className="my-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {cartList.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {product.name}
                        </h5>
                        <p className="text-xs text-zinc-500">
                          {shop.currencySymbol}
                          {product.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{quantity}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="w-16 text-right text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {shop.currencySymbol}
                          {(product.price * quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cooking Instructions */}
                <div className="mt-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    Special Cooking Notes / Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="e.g. Less spicy, Extra butter, No onions..."
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Total */}
                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total Payable</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {shop.currencySymbol}
                    {cartTotal.toFixed(2)}
                  </span>
                </div>

                {isVerified ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Logged in as <b>{customerName || customerPhone}</b>
                    </span>
                    <button onClick={handleResetVerification} className="underline text-[11px]">
                      Change
                    </button>
                  </div>
                ) : null}

                <button
                  onClick={() => setStep(isVerified ? "payment" : "login")}
                  disabled={cartList.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  {isVerified ? (
                    <>
                      Proceed to Payment <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Proceed to Login & Verify OTP <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 2: MOBILE LOGIN & OTP VERIFICATION */}
            {step === "login" && (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/60 p-3.5 text-center dark:bg-emerald-950/20">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Customer Mobile Login
                  </h4>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Enter your phone number to receive an instant OTP verification.
                  </p>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {otpError}
                  </div>
                )}

                {!otpSent ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Your Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-zinc-400">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="9876543210"
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-12 pr-4 text-sm font-semibold tracking-wider text-zinc-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSendOtp}
                      disabled={sendingOtp || customerPhone.length < 10}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {sendingOtp ? "Sending OTP..." : "Get OTP via SMS"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        OTP sent to: <b>+91-{customerPhone}</b>
                      </span>
                      <button
                        onClick={() => setOtpSent(false)}
                        className="font-semibold text-emerald-600 hover:underline"
                      >
                        Change Number
                      </button>
                    </div>

                    {/* Instant Demo OTP helper badge */}
                    {devOtp && (
                      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-2.5 text-center text-xs dark:border-amber-700/40 dark:bg-amber-950/30">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">
                          ✨ Instant OTP for testing:{" "}
                          <span className="font-mono text-sm font-bold tracking-widest">{devOtp}</span>
                        </span>
                        <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                          (Auto-filled below for fast dine-in order confirmation)
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Enter 4-Digit OTP
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 1234"
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-center font-mono text-xl font-black tracking-widest text-zinc-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>

                    <button
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || otp.length < 4}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {verifyingOtp ? "Verifying..." : "Verify OTP & Continue to Payment"}
                    </button>

                    <div className="text-center">
                      <button
                        onClick={handleSendOtp}
                        className="text-xs font-semibold text-zinc-500 hover:text-emerald-600"
                      >
                        Didn&apos;t receive? Resend OTP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PAYMENT GATEWAY */}
            {step === "payment" && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
                  <div>
                    <span className="text-[11px] text-zinc-500">Order for {table}</span>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {customerName || "Customer"} · +91-{customerPhone}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-zinc-500">Payable Amount</span>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {shop.currencySymbol}
                      {cartTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Payment Option Tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMode("UPI")}
                    className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                      paymentMode === "UPI"
                        ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                    }`}
                  >
                    <QrCode className="h-5 w-5 text-emerald-600" />
                    <span className="mt-1 text-xs font-bold">Pay Now via UPI</span>
                    <span className="text-[10px] text-zinc-500">GPay, PhonePe, Paytm</span>
                  </button>

                  <button
                    onClick={() => setPaymentMode("CASH")}
                    className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                      paymentMode === "CASH"
                        ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                    }`}
                  >
                    <Store className="h-5 w-5 text-emerald-600" />
                    <span className="mt-1 text-xs font-bold">Pay at Counter</span>
                    <span className="text-[10px] text-zinc-500">Cash/Card after meal</span>
                  </button>
                </div>

                {/* UPI Mode View */}
                {paymentMode === "UPI" && (
                  <div className="flex flex-col items-center rounded-2xl border border-zinc-200/80 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Scan or Tap to Pay with Any UPI App
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      UPI ID: <span className="font-mono font-bold text-emerald-600">{shop.upiId || (shop.phone ? `${shop.phone.replace(/\D/g, '')}@upi` : "merchant@upi")}</span>
                    </p>

                    <div className="my-3 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-zinc-200">
                      {upiQrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={upiQrDataUrl}
                          alt="UPI Payment QR Code"
                          className="h-44 w-44 object-contain"
                        />
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center text-xs text-zinc-400">
                          Generating UPI QR...
                        </div>
                      )}
                    </div>

                    {/* Direct App Link for Mobile Phones */}
                    <a
                      href={upiUrl}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95"
                    >
                      <CreditCard className="h-4 w-4" /> Open GPay / PhonePe / Paytm
                    </a>

                    <div className="mt-3 w-full text-left">
                      <label className="text-[11px] font-semibold text-zinc-500">
                        UPI Transaction ID / UTR (Optional)
                      </label>
                      <input
                        type="text"
                        value={upiUtr}
                        onChange={(e) => setUpiUtr(e.target.value)}
                        placeholder="e.g. 334125678912"
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                )}

                {/* CASH Mode View */}
                {paymentMode === "CASH" && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-800/40">
                    <Store className="mx-auto h-8 w-8 text-emerald-600" />
                    <h5 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Pay Later at Cashier Counter
                    </h5>
                    <p className="mt-1 text-xs text-zinc-500">
                      Your order will be sent to the kitchen now. You can settle the bill via Cash, Card, or UPI
                      at the counter after dining.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleConfirmOrder}
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    "Sending to Kitchen..."
                  ) : paymentMode === "UPI" ? (
                    <>
                      <Check className="h-4 w-4" /> I Have Paid & Place Order
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Place Dine-in Order (Pay Later)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Order Tracker Modal */}
      {isTrackingOpen && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl dark:bg-zinc-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">Order Sent to Kitchen!</h3>
            <p className="text-xs text-zinc-500">
              Token: <span className="font-mono font-bold text-emerald-600">#{activeOrder.pickupCode}</span> ·{" "}
              {activeOrder.table}
            </p>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {activeOrder.paid ? "💳 Paid Online (UPI)" : "💵 Pay at Counter"}
            </div>

            {/* Status Steps */}
            <div className="my-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    activeOrder.status === "NEW"
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Order Received</h6>
                  <p className="text-[11px] text-zinc-500">Kitchen counter received your order</p>
                </div>
              </div>

              <div className="my-2 ml-4 h-4 w-0.5 bg-zinc-200 dark:bg-zinc-700" />

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    activeOrder.status === "PACKING"
                      ? "bg-amber-500 text-white animate-pulse"
                      : activeOrder.status === "READY" || activeOrder.status === "COLLECTED"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800"
                  }`}
                >
                  <ChefHat className="h-4 w-4" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Preparing Dishes</h6>
                  <p className="text-[11px] text-zinc-500">Chef is cooking your meal</p>
                </div>
              </div>

              <div className="my-2 ml-4 h-4 w-0.5 bg-zinc-200 dark:bg-zinc-700" />

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    activeOrder.status === "READY" || activeOrder.status === "COLLECTED"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Ready / Serving</h6>
                  <p className="text-[11px] text-zinc-500">Food is being served at {activeOrder.table}</p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Total Amount: {shop.currencySymbol}
              {activeOrder.total.toFixed(2)}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setIsTrackingOpen(false)}
                className="w-full rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Close & Order More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm font-semibold text-zinc-500">
          Loading digital menu...
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
