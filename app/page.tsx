"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ShieldAlert, Zap, Layers, RefreshCw } from "lucide-react";

type Warehouse = {
  id: string;
  name: string;
  location: string;
};

type Stock = {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
  warehouse: Warehouse;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  stock: Stock[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [chaosRunning, setChaosRunning] = useState(false);

  // Keep a ref to the latest products array to avoid stale closures in the event listener
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Connect to SSE stream for live updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stock-updates");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "INIT" || data.type === "UPDATE") {
          setProducts(data.products);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      // Fall back to direct fetching if SSE fails
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          setProducts(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed fallback direct fetch:", error);
        });
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Handle single reservation
  const handleReserve = async (productId: string, warehouseId: string) => {
    const key = `${productId}-${warehouseId}`;
    setReservingId(key);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: 1,
          userId: `user-${Math.random().toString(36).substring(2, 9)}`,
        }),
      });

      if (response.status === 409) {
        toast({
          title: "Out of Stock!",
          description: "All units of this product have already been reserved in this warehouse by other shoppers.",
          variant: "destructive",
        });
      } else if (response.ok) {
        const reservation = await response.json();
        toast({
          title: "Temporary Hold Created",
          description: "One unit has been reserved for 10 minutes. Redirecting to checkout...",
          variant: "success",
        });
        // Short timeout to allow toast to register before moving
        setTimeout(() => {
          window.location.href = `/checkout/${reservation.id}`;
        }, 800);
      } else {
        const errData = await response.json();
        toast({
          title: "Reservation Failed",
          description: errData.error || "An unknown error occurred during reservation.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to reserve unit:", error);
      toast({
        title: "Connection Error",
        description: "Could not reach the server to establish an inventory reservation.",
        variant: "destructive",
      });
    } finally {
      setReservingId(null);
    }
  };

  // Chaos Mode: fire 10 concurrent requests at once to attempt to reserve a single unit
  const triggerChaosMode = async () => {
    const currentProducts = productsRef.current;
    if (currentProducts.length === 0 || chaosRunning) return;

    // Find first product that has at least 1 unit of available stock (for maximum demonstration impact)
    // If none exists, just fallback to the first product
    let targetProduct = currentProducts.find((p) =>
      p.stock.some((s) => s.totalUnits - s.reservedUnits > 0)
    );
    if (!targetProduct) {
      targetProduct = currentProducts[0];
    }

    // Find the warehouse with available stock (or first warehouse)
    let targetStock = targetProduct.stock.find((s) => s.totalUnits - s.reservedUnits > 0);
    if (!targetStock) {
      targetStock = targetProduct.stock[0];
    }

    const warehouseId = targetStock.warehouseId;
    const warehouseName = targetStock.warehouse.name;
    const productId = targetProduct.id;
    const productName = targetProduct.name;

    setChaosRunning(true);
    toast({
      title: "Triggering Chaos Mode...",
      description: `Firing 10 simultaneous parallel checkout reservation requests for ${productName} in ${warehouseName}.`,
    });

    try {
      const requests = Array(10)
        .fill(null)
        .map(async (_, index) => {
          try {
            const response = await fetch("/api/reservations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId,
                warehouseId,
                quantity: 1,
                userId: `chaos-user-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
              }),
            });
            return response.status;
          } catch (e) {
            return 500;
          }
        });

      const results = await Promise.all(requests);
      const successCount = results.filter((status) => status === 200).length;
      const conflictCount = results.filter((status) => status === 409).length;
      const errorCount = results.filter((status) => status !== 200 && status !== 409).length;

      // Toast output results clearly
      if (successCount > 0) {
        toast({
          title: `Chaos Simulation Completed`,
          description: `Successful: ${successCount} | Blocked (409): ${conflictCount} | Errors: ${errorCount}. Database lock prevented double-booking.`,
          variant: "success",
        });
      } else {
        toast({
          title: `Chaos Simulation Blocked`,
          description: `All requests blocked. Successful: 0 | Blocked (409): ${conflictCount} | Errors: ${errorCount}. No stock remained.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Chaos mode triggered error:", err);
      toast({
        title: "Simulation Failed",
        description: "An error occurred executing the parallel network triggers.",
        variant: "destructive",
      });
    } finally {
      setChaosRunning(false);
    }
  };

  // Keyboard shortcut listener (Ctrl+Shift+C) bound safely to state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "C") {
        e.preventDefault();
        triggerChaosMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [products]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Header */}
      <div className="mb-10 text-center md:text-left md:flex md:items-center md:justify-between border-b border-zinc-900 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-black">
            Real-Time Product Catalog
          </h1>
          <p className="mt-2 text-sm md:text-base text-zinc-400">
            Select a product and reserve stock. The units will be locked temporarily to complete payment.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2 justify-center md:justify-end">
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1.5 text-xs text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live stock feeds via SSE active
          </div>
        </div>
      </div>

      {loading ? (
        // Beautiful Skeleton Loader
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="h-64 rounded-xl border border-zinc-800/40 bg-zinc-950/20 p-6 animate-pulse">
              <div className="h-6 w-1/2 rounded bg-zinc-800 mb-4"></div>
              <div className="h-4 w-5/6 rounded bg-zinc-800 mb-8"></div>
              <div className="space-y-3">
                <div className="h-8 rounded bg-zinc-800"></div>
                <div className="h-8 rounded bg-zinc-800"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Product Grid
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            return (
              <div
                key={product.id}
                className="premium-card flex flex-col justify-between rounded-xl p-6"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-xl font-bold tracking-tight text-white group-hover:text-violet-400">
                      {product.name}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400 min-h-[40px]">
                    {product.description || "Premium high-grade quality guaranteed."}
                  </p>
                </div>

                <div className="mt-6 border-t border-zinc-800/60 pt-4">
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3 block">
                    Available Stock per Warehouse
                  </span>

                  <div className="space-y-3">
                    {product.stock.map((s) => {
                      const available = s.totalUnits - s.reservedUnits;
                      const isOutOfStock = available <= 0;
                      const key = `${product.id}-${s.warehouseId}`;
                      const isCurrentlyReserving = reservingId === key;

                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 p-2.5 hover:border-zinc-800 transition-colors"
                        >
                          <div className="grid">
                            <span className="text-sm font-semibold text-zinc-200">
                              {s.warehouse.name}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {s.warehouse.location}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span
                                className={`text-sm font-bold block ${
                                  isOutOfStock ? "text-red-500" : "text-emerald-400"
                                }`}
                              >
                                {available} units
                              </span>
                              <span className="text-[10px] text-zinc-600 block">
                                {s.reservedUnits} held
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant={isOutOfStock ? "outline" : "default"}
                              disabled={isOutOfStock || isCurrentlyReserving || chaosRunning}
                              onClick={() => handleReserve(product.id, s.warehouseId)}
                              className={`h-7 px-3 text-xs font-semibold ${
                                isOutOfStock
                                  ? "border-red-950/20 text-red-500/40 hover:bg-transparent"
                                  : "bg-violet-600 hover:bg-violet-500 text-white"
                              }`}
                            >
                              {isCurrentlyReserving ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : isOutOfStock ? (
                                "Out"
                              ) : (
                                "Reserve"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for Chaos Mode */}
      <div className="fixed bottom-6 right-6 z-30">
        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-red-600 to-amber-600 opacity-60 blur transition duration-1000 group-hover:opacity-100 group-hover:duration-200 animate-pulse"></div>
          <Button
            onClick={triggerChaosMode}
            disabled={loading || chaosRunning}
            className="relative flex items-center gap-2 rounded-full border border-red-950 bg-zinc-950 px-5 py-6 text-sm font-bold text-white shadow-2xl transition-all duration-200 active:scale-95 disabled:opacity-40"
          >
            {chaosRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
            ) : (
              <Zap className="h-4 w-4 text-amber-500" />
            )}
            <span>Chaos Mode</span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-red-900 bg-red-950/40 px-1.5 font-mono text-[9px] font-medium text-red-300">
              Ctrl+Shift+C
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
