import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-forge-500 text-ink-950 hover:bg-forge-400',
        variant === 'secondary' && 'border border-ink-700 bg-ink-850 text-ink-100 hover:bg-ink-800',
        variant === 'ghost' && 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
        variant === 'danger' && 'border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-950/70',
        className,
      )}
    />
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('rounded-xl border border-ink-700 bg-ink-900', onClick && 'cursor-pointer hover:border-ink-600', className)}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-400 focus:border-forge-500 focus:outline-none';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-forge-500' : 'bg-ink-700')}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-4.5' : 'left-0.5')} />
    </button>
  );
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn('max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'forge' | 'green' | 'red' | 'blue' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-ink-800 text-ink-300',
        tone === 'forge' && 'bg-forge-500/15 text-forge-400',
        tone === 'green' && 'bg-emerald-500/15 text-emerald-400',
        tone === 'red' && 'bg-red-500/15 text-red-400',
        tone === 'blue' && 'bg-sky-500/15 text-sky-400',
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, body, actions }: { title: string; body?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {body && <p className="mt-1 max-w-2xl text-sm text-ink-300">{body}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

/** FrameForge's mark: a film frame with a spark. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 8.5h19M2.5 15.5h19" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
      <path d="M13 6.5 9.5 12.5H12l-1 5 3.5-6H12l1-5Z" fill="#f97316" />
    </svg>
  );
}
