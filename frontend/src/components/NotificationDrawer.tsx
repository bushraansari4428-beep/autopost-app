'use client';
import { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  ExternalLink, 
  CheckCheck,
  Bell
} from 'lucide-react';
import Link from 'next/link';

export interface AlertItem {
  id: string;
  type: 'TOKEN_INVALID' | 'UPLOAD_FAILED' | 'SYSTEM_WARN';
  severity: 'CRITICAL' | 'WARNING';
  title: string;
  message: string;
  pageName?: string;
  timestamp: string;
  actionText?: string;
  actionUrl?: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  alerts,
  onDismiss,
  onDismissAll,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800/80 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white flex items-center gap-2">
                  <span>Emergency Alerts</span>
                  {alerts.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
                      {alerts.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Page mishaps, token errors & failed uploads</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar */}
          {alerts.length > 0 && (
            <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                {alerts.length} unresolved {alerts.length === 1 ? 'issue' : 'issues'}
              </span>
              <button 
                onClick={onDismissAll}
                className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Dismiss All</span>
              </button>
            </div>
          )}

          {/* Alerts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <CheckCheck className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-slate-200 text-sm">All Clear! No Active Mishaps</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  All your connected pages, tokens, and automated video queues are operating smoothly without issues.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isCritical = alert.severity === 'CRITICAL';
                return (
                  <div 
                    key={alert.id}
                    className={`rounded-xl p-4 border transition-all ${
                      isCritical
                        ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                        : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                          isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {isCritical ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-100">{alert.title}</h4>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {alert.message}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onDismiss(alert.id)}
                        className="text-slate-500 hover:text-slate-300 p-1 rounded transition shrink-0"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {alert.actionUrl && (
                        <Link
                          href={alert.actionUrl}
                          onClick={onClose}
                          className={`font-semibold flex items-center gap-1 hover:underline ${
                            isCritical ? 'text-red-400 hover:text-red-300' : 'text-amber-400 hover:text-amber-300'
                          }`}
                        >
                          <span>{alert.actionText || 'Fix Issue'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
