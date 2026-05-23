"use client";

import { useToast } from "./use-toast";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col md:max-w-[380px] gap-2">
      {toasts.map(function ({ id, title, description, variant }) {
        const handleDismiss = () => {
          // Trigger dismiss internally by filtering it out or using custom event
          const dismissEvent = new CustomEvent("dismiss-toast", { detail: id });
          window.dispatchEvent(dismissEvent);
        };

        return (
          <div
            key={id}
            className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-6 ${
              variant === "destructive"
                ? "border-red-900 bg-red-950/95 text-red-50"
                : variant === "success"
                ? "border-emerald-900 bg-emerald-950/95 text-emerald-50"
                : "border-zinc-800 bg-zinc-900/95 text-zinc-50"
            }`}
          >
            <div className="grid gap-1 pr-6">
              {title && <div className="text-sm font-semibold">{title}</div>}
              {description && (
                <div className="text-xs opacity-85 leading-relaxed">
                  {description}
                </div>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-50 focus:opacity-100 focus:outline-none group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
export default Toaster;
