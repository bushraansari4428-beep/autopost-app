'use client';
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastProps) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
        isSuccess
          ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-100 shadow-emerald-900/20'
          : isError
          ? 'bg-rose-950/80 border-rose-500/40 text-rose-100 shadow-rose-900/20'
          : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-100 shadow-indigo-900/20'
      }`}
    >
      <div className="flex items-center gap-3 pr-2">
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-indigo-400 shrink-0" />}
        <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0 text-white/60 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
