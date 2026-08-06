/** Minimal toast system   " immediate feedback per Doc 05   12. */
import { useEffect, useState } from 'react';

interface ToastMsg {
  id: number;
  text: string;
  type?: 'ok' | 'err' | 'info';
  title?: string;
}

let nextId = 1;
const listeners = new Set<(t: ToastMsg) => void>();

export function toast(text: string, type: 'ok' | 'err' | 'info' = 'info', title?: string): void {
  const msg = { id: nextId++, text, type, title };
  listeners.forEach((l) => l(msg));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const on = (t: ToastMsg) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  return (
    <div className="uk-toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const icon = t.type === 'ok' ? null : t.type === 'err' ? null : null;
        const resolvedTitle =
          t.title ?? (t.type === 'ok' ? 'Success' : t.type === 'err' ? 'Error' : 'Notification');
        return (
          <div key={t.id} className={`uk-toast uk-toast--${t.type ?? 'info'}`}>
            <div className="uk-toast__ico">{icon}</div>
            <div className="uk-toast__body">
              <strong>{resolvedTitle}</strong>
              <span>{t.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
