"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  QrCode,
  Store,
  Plus,
  Trash2,
  Printer,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChefHat,
  ShoppingBag,
  Download,
  Eye,
  Settings,
  Sparkles,
  Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, describeApiError } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import Link from "next/link";

interface ActiveOrder {
  id: number;
  pickupCode: string;
  customerName: string;
  status: string;
  total: number;
  itemCount: number;
  items: { name: string; quantity: number; price: number }[];
  createdAt: string;
  note: string | null;
}

interface TableItem {
  id: string;
  name: string;
  activeOrders: ActiveOrder[];
}

interface TablesResponse {
  tables: TableItem[];
  totalTables: number;
  occupiedCount: number;
}

export default function TablesPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol ?? "Rs.";
  const { show } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"floor" | "print" | "manage">("floor");
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [allQrs, setAllQrs] = useState<Record<string, string>>({});

  // Manage tables state
  const [newTableName, setNewTableName] = useState<string>("");
  const [tableList, setTableList] = useState<string[]>([]);

  // Detect Host IP / Base URL on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Fetch tables and live active orders (polls every 6 seconds)
  const { data, isLoading } = useQuery<TablesResponse>({
    queryKey: ["tables"],
    queryFn: () => api.get<TablesResponse>("/tables"),
    refetchInterval: 6_000,
  });

  const tables = data?.tables ?? [];
  const occupiedCount = data?.occupiedCount ?? 0;
  const totalTables = data?.totalTables ?? 0;

  // Sync table names for management
  useEffect(() => {
    if (tables.length > 0 && tableList.length === 0) {
      setTableList(tables.map((t) => t.name));
    }
  }, [tables, tableList.length]);

  // Generate QR code whenever selectedTableForQr or baseUrl changes
  useEffect(() => {
    if (!selectedTableForQr || !baseUrl) return;
    const menuUrl = `${baseUrl}/menu?table=${encodeURIComponent(selectedTableForQr.name)}`;
    QRCode.toDataURL(menuUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#064e3b",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Failed to generate QR:", err));
  }, [selectedTableForQr, baseUrl]);

  // Pre-generate all QRs for Print tab
  useEffect(() => {
    if (tables.length === 0 || !baseUrl) return;
    const promises = tables.map(async (t) => {
      const menuUrl = `${baseUrl}/menu?table=${encodeURIComponent(t.name)}`;
      const url = await QRCode.toDataURL(menuUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#064e3b",
          light: "#ffffff",
        },
      });
      return [t.name, url] as const;
    });

    Promise.all(promises).then((entries) => {
      setAllQrs(Object.fromEntries(entries));
    });
  }, [tables, baseUrl]);

  // Save updated tables mutation
  const saveTablesMutation = useMutation({
    mutationFn: (updated: string[]) => api.post("/tables", { tables: updated }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      show("Tables updated successfully!", "success");
    },
    onError: (err) => show(describeApiError(err, "Failed to update tables"), "error"),
  });

  const handleAddTable = () => {
    const trimmed = newTableName.trim();
    if (!trimmed) return;
    if (tableList.includes(trimmed)) {
      return show("A table with this name already exists", "error");
    }
    const updated = [...tableList, trimmed];
    setTableList(updated);
    setNewTableName("");
    saveTablesMutation.mutate(updated);
  };

  const handleRemoveTable = (name: string) => {
    if (tableList.length <= 1) {
      return show("At least one table must remain", "error");
    }
    const updated = tableList.filter((t) => t !== name);
    setTableList(updated);
    saveTablesMutation.mutate(updated);
  };

  const downloadQr = (tableName: string, dataUrl: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR_${tableName.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Table QR & Dine-in Floor"
        subtitle="Manage restaurant tables, generate high-resolution QR codes for dine-in ordering, and monitor live table orders in real time."
        actions={
          <div className="flex gap-2">
            <Button
              variant={activeTab === "floor" ? "primary" : "secondary"}
              onClick={() => setActiveTab("floor")}
            >
              <Store className="h-4 w-4" /> Floor View ({occupiedCount}/{totalTables})
            </Button>
            <Button
              variant={activeTab === "print" ? "primary" : "secondary"}
              onClick={() => setActiveTab("print")}
            >
              <Printer className="h-4 w-4" /> Print Standees
            </Button>
            <Button
              variant={activeTab === "manage" ? "primary" : "secondary"}
              onClick={() => setActiveTab("manage")}
            >
              <Settings className="h-4 w-4" /> Manage Tables
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-foreground/60">Total Tables</p>
            <p className="text-2xl font-bold text-foreground">{totalTables}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Store className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-foreground/60">Occupied / Dining</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{occupiedCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ChefHat className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-foreground/60">Available Tables</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {Math.max(0, totalTables - occupiedCount)}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tab 1: Live Floor View */}
      {activeTab === "floor" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Live Table Floor</h3>
            <span className="flex items-center gap-1 text-xs text-foreground/60">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-500" /> Auto-updating
              every 6s
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tables.map((table) => {
              const isOccupied = table.activeOrders.length > 0;
              const primaryOrder = table.activeOrders[0];

              return (
                <div
                  key={table.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
                    isOccupied
                      ? "border-amber-400/60 bg-amber-500/5 dark:border-amber-600/40"
                      : "border-border bg-surface hover:border-brand/40"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground/50">{table.id}</span>
                        <h4 className="text-lg font-bold text-foreground">{table.name}</h4>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isOccupied
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {isOccupied ? (
                          <>
                            <ChefHat className="h-3 w-3" /> Dining
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Vacant
                          </>
                        )}
                      </span>
                    </div>

                    {/* Active Order Details */}
                    {isOccupied ? (
                      <div className="my-3 space-y-1.5 rounded-xl border border-amber-300/40 bg-amber-500/10 p-2.5 text-xs dark:border-amber-700/30">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="font-mono text-amber-700 dark:text-amber-300">
                            #{primaryOrder.pickupCode}
                          </span>
                          <span className="font-bold text-foreground">
                            {sym}
                            {primaryOrder.total.toFixed(2)}
                          </span>
                        </div>

                        <p className="line-clamp-1 text-foreground/70">
                          {primaryOrder.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-foreground/50">
                          <span>Status: {primaryOrder.status}</span>
                          <span>{primaryOrder.itemCount} items</span>
                        </div>
                      </div>
                    ) : (
                      <div className="my-5 text-center text-xs text-foreground/40">
                        No active orders on this table.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <button
                      onClick={() => setSelectedTableForQr(table)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                    >
                      <QrCode className="h-4 w-4" /> View QR
                    </button>

                    {isOccupied ? (
                      <Link href="/orders">
                        <Button variant="secondary" className="!h-7 !px-2.5 text-xs">
                          <ShoppingBag className="h-3 w-3" /> Manage Bill
                        </Button>
                      </Link>
                    ) : (
                      <a
                        href={`/menu?table=${encodeURIComponent(table.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Test Menu
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Print Standees */}
      {activeTab === "print" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="max-w-md">
              <h4 className="text-sm font-semibold text-foreground">Table Standee QR Generator</h4>
              <p className="mt-0.5 text-xs text-foreground/60">
                Print high-resolution table standees or stickers. Customers scan with their phone camera to order
                directly to your kitchen.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-foreground/70">
                <Wifi className="h-4 w-4 text-brand" />
                <span className="font-mono text-xs">{baseUrl}</span>
              </div>
              <Button onClick={() => window.print()} variant="primary">
                <Printer className="h-4 w-4" /> Print All Standees
              </Button>
            </div>
          </div>

          {/* Standees Grid (Optimized for print) */}
          <div id="print-area" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tables.map((table) => {
              const qr = allQrs[table.name];
              return (
                <div
                  key={table.id}
                  className="flex flex-col items-center justify-between rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center shadow-sm"
                >
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                      {shop?.shopName ?? "NodeDR POS"}
                    </span>
                    <h3 className="mt-1 text-2xl font-black text-foreground">{table.name}</h3>
                    <p className="mt-0.5 text-xs text-foreground/60">Dine-in Table Menu</p>
                  </div>

                  <div className="my-4 rounded-xl bg-white p-3 shadow-inner ring-1 ring-zinc-200">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt={`QR for ${table.name}`} className="h-44 w-44 object-contain" />
                    ) : (
                      <div className="flex h-44 w-44 items-center justify-center text-xs text-foreground/40">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-foreground">Scan with Phone Camera</p>
                    <p className="mt-0.5 text-[11px] text-foreground/60">To view menu & place your order</p>
                  </div>

                  <div className="mt-4 flex w-full gap-2 border-t border-border pt-3">
                    <Button
                      variant="secondary"
                      className="w-full !py-1.5 text-xs"
                      onClick={() => qr && downloadQr(table.name, qr)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <a
                      href={`/menu?table=${encodeURIComponent(table.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button variant="ghost" className="w-full !py-1.5 text-xs">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Manage Tables */}
      {activeTab === "manage" && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-base font-semibold text-foreground">Configure Tables</h3>
            <p className="mt-0.5 text-xs text-foreground/60">
              Add, remove, or customize table names (e.g. Table 1, Table 2, Patio A, AC Cabin 1).
            </p>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
                placeholder="e.g. Table 9, Rooftop 1, Cabin A"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
              <Button onClick={handleAddTable} variant="primary">
                <Plus className="h-4 w-4" /> Add Table
              </Button>
            </div>

            <div className="mt-5 divide-y divide-border rounded-xl border border-border">
              {tableList.map((tableName, index) => (
                <div key={tableName} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-foreground/60">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{tableName}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveTable(tableName)}
                    className="rounded-lg p-1.5 text-foreground/40 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title={`Delete ${tableName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Single Table QR Modal */}
      {selectedTableForQr && (
        <Modal
          onClose={() => setSelectedTableForQr(null)}
          title={`QR Code for ${selectedTableForQr.name}`}
        >
          <div className="flex flex-col items-center p-4 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand">
              {shop?.shopName ?? "Restaurant Menu"}
            </span>
            <h3 className="mt-0.5 text-2xl font-black text-foreground">{selectedTableForQr.name}</h3>

            <div className="my-5 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-200">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR for ${selectedTableForQr.name}`}
                  className="h-60 w-60 object-contain"
                />
              ) : (
                <div className="flex h-60 w-60 items-center justify-center text-xs text-foreground/40">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="text-xs text-foreground/70">
              Scan URL:{" "}
              <span className="font-mono text-[11px] text-brand">
                {baseUrl}/menu?table={encodeURIComponent(selectedTableForQr.name)}
              </span>
            </p>

            <div className="mt-5 flex w-full gap-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => downloadQr(selectedTableForQr.name, qrDataUrl)}
              >
                <Download className="h-4 w-4" /> Download QR Image
              </Button>
              <a
                href={`${baseUrl}/menu?table=${encodeURIComponent(selectedTableForQr.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="secondary" className="w-full">
                  <ExternalLink className="h-4 w-4" /> Open Menu
                </Button>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
