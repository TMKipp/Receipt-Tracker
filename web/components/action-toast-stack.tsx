"use client";

export type ActionToast = {
  id: string;
  title: string;
  detail: string;
  tone?: "good" | "warn" | "neutral";
};

type ActionToastStackProps = {
  toasts: ActionToast[];
  onDismiss: (id: string) => void;
};

export function ActionToastStack({ toasts, onDismiss }: ActionToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="action-toast-stack" aria-live="polite" aria-label="Recent actions">
      {toasts.map((toast) => (
        <article key={toast.id} className={`action-toast ${toast.tone ? `is-${toast.tone}` : "is-neutral"}`}>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.detail}</p>
          </div>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label={`Dismiss ${toast.title}`}>
            Dismiss
          </button>
        </article>
      ))}
    </div>
  );
}
