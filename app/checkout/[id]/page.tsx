"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Clock, ShieldCheck, ArrowLeft, Loader2, Sparkles, XCircle } from "lucide-react";

type Reservation = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  product: {
    name: string;
    description: string | null;
  };
  warehouse: {
    name: string;
    location: string;
  };
};

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("10:00");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isExpired, setIsExpired] = useState(false);
  
  const router = useRouter();
  const reservationId = params.id;

  // Fetch reservation details on load
  useEffect(() => {
    fetch(`/api/reservations/${reservationId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reservation details");
        return res.json();
      })
      .then((data) => {
        setReservation(data);
        setLoading(false);

        // Calculate initial remaining seconds
        const expiry = new Date(data.expiresAt).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((expiry - now) / 1000));
        setSecondsRemaining(diff);

        if (data.status !== "pending") {
          setIsExpired(true);
        }
      })
      .catch((err) => {
        console.error(err);
        toast({
          title: "Reservation Not Found",
          description: "This reservation ticket does not exist or was deleted.",
          variant: "destructive",
        });
        setLoading(false);
      });
  }, [reservationId]);

  // Live countdown timer
  useEffect(() => {
    if (loading || !reservation || reservation.status !== "pending" || secondsRemaining <= 0) {
      if (secondsRemaining <= 0 && reservation?.status === "pending") {
        setIsExpired(true);
        setTimeLeft("Expired!");
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          setIsExpired(true);
          setTimeLeft("Expired!");
          
          // Show alert toast to the user
          toast({
            title: "Hold Period Expired",
            description: "Your inventory hold window has expired. The stock unit has been returned to circulation.",
            variant: "destructive",
          });
          return 0;
        }

        const minutes = Math.floor(next / 60);
        const seconds = next % 60;
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, reservation, secondsRemaining]);

  // Confirm Purchase
  const handleConfirm = async () => {
    if (!reservation) return;
    setConfirming(true);

    try {
      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
      });

      if (response.status === 410) {
        toast({
          title: "Purchase Blocked",
          description: "This checkout request was rejected because the 10-minute hold window expired. Please try again.",
          variant: "destructive",
        });
        setIsExpired(true);
        setTimeLeft("Expired!");
      } else if (response.ok) {
        toast({
          title: "Order Placed Successfully",
          description: "Your secure purchase confirmation has been logged, and inventory has been permanently allocated.",
          variant: "success",
        });
        // Redirect back home with status
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } else {
        const errData = await response.json();
        toast({
          title: "Confirmation Error",
          description: errData.error || "Failed to confirm allocation.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Connection Failed",
        description: "Could not finalize the secure booking transaction.",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  // Cancel Reservation
  const handleCancel = async () => {
    if (!reservation) return;
    setCancelling(true);

    try {
      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Hold Cancelled Early",
          description: "The reserved item has been released back into available warehouse inventory.",
        });
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } else {
        const errData = await response.json();
        toast({
          title: "Cancellation Failed",
          description: errData.error || "Failed to release inventory.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Connection Failed",
        description: "Could not communicate early cancellation to the server.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm text-zinc-400">Securing checkout session token...</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-8">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Ticket Inactive</h1>
          <p className="text-sm text-zinc-400 mb-6">
            The requested checkout session does not exist or has been invalidated.
          </p>
          <Button onClick={() => router.push("/")} className="w-full bg-zinc-800 hover:bg-zinc-700">
            Back to Catalog
          </Button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min(100, Math.max(0, (secondsRemaining / 600) * 100));
  const isUrgent = secondsRemaining < 60; // less than 1 minute

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* Return Button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Product List
      </button>

      {/* Main Checkout Panel */}
      <div className="premium-card rounded-xl overflow-hidden shadow-2xl">
        {/* Banner Alert */}
        <div className="bg-gradient-to-r from-violet-950/40 to-indigo-950/40 px-6 py-4 border-b border-zinc-800/80 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-violet-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-violet-300">
            Stock Temporarily Guaranteed
          </span>
        </div>

        <div className="p-6 md:p-8">
          {/* Product and warehouse summary */}
          <div className="mb-6">
            <span className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Product Details</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">{reservation.product.name}</h1>
            <p className="text-sm text-zinc-400 mt-1">{reservation.product.description || "Premium retail quality hold."}</p>

            <div className="grid grid-cols-2 gap-4 mt-6 border-y border-zinc-850 py-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Fulfillment Point</span>
                <span className="text-sm font-semibold text-zinc-200 mt-0.5 block">{reservation.warehouse.name}</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">{reservation.warehouse.location}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Allocated Quantity</span>
                <span className="text-sm font-bold text-zinc-200 mt-0.5 block">{reservation.quantity} Unit</span>
                <span className="text-xs text-zinc-500 mt-0.5 block">1 Hold slot reservation</span>
              </div>
            </div>
          </div>

          {/* Expiry Clock Indicator */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${isUrgent ? "text-red-500 animate-pulse" : "text-violet-400"}`} />
                <span className="text-xs font-semibold text-zinc-300">Hold Expiration Counter</span>
              </div>
              <span className={`text-xs font-mono font-bold ${isUrgent ? "text-red-500 animate-pulse" : "text-violet-400"}`}>
                {reservation.status !== "pending" ? reservation.status.toUpperCase() : timeLeft}
              </span>
            </div>

            {/* Time progress bar */}
            {reservation.status === "pending" && (
              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    isUrgent ? "bg-red-500 animate-pulse" : "bg-gradient-to-r from-violet-600 to-indigo-500"
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            )}

            {reservation.status === "pending" && (
              <p className="text-[10px] text-zinc-500 mt-2.5 leading-relaxed">
                We are holding this item exclusively for you. Complete your check-out before the countdown reaches zero, or the inventory hold will be released automatically.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {reservation.status === "pending" && !isExpired ? (
              <>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || cancelling}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold h-11 active:scale-98 shadow-lg shadow-violet-500/10"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 text-violet-200" />
                      Confirm Purchase
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={confirming || cancelling}
                  className="sm:w-1/3 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 h-11"
                >
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Cancel Hold"
                  )}
                </Button>
              </>
            ) : (
              <div className="w-full">
                <div className="rounded-lg border border-red-900 bg-red-950/20 p-4 text-center mb-4">
                  <span className="text-sm font-semibold text-red-400">
                    This reservation has been resolved or expired.
                  </span>
                </div>
                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold h-11"
                >
                  Return to Product Catalog
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
