import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

type Listener = (toasts: Toast[]) => void;

let listeners: Listener[] = [];
let toasts: Toast[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("dismiss-toast", (e: any) => {
    const id = e.detail;
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(toasts));
  });
}

export function toast({
  title,
  description,
  variant = "default",
}: Omit<Toast, "id">) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: Toast = { id, title, description, variant };
  toasts = [...toasts, newToast];
  listeners.forEach((listener) => listener(toasts));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(toasts));
  }, 4000);

  return {
    id,
    dismiss: () => {
      toasts = toasts.filter((t) => t.id !== id);
      listeners.forEach((listener) => listener(toasts));
    },
  };
}

export function useToast() {
  const [state, setState] = React.useState<Toast[]>(toasts);

  React.useEffect(() => {
    listeners.push(setState);
    setState(toasts);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);

  return {
    toasts: state,
    toast,
  };
}
