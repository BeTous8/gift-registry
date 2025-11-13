"use client";

import { ToastProvider } from "./ToastProvider";

export function ClientToastProvider({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

