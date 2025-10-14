import { useState } from "react";

interface ToastOptions {
  description: string;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const toast = (options: ToastOptions) => {
    console.log("Toast:", options.description);
    setToasts(prev => [...prev, options]);
    
    // Auto-remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, options.duration || 3000);
  };

  return { toast };
}