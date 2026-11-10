import { STEPS, type Step } from '@frameforge/shared';
import { Check } from 'lucide-react';
import { useT } from '../i18n';
import { cn } from './ui';

export function StepBar({ step }: { step: Step }) {
  const t = useT();
  const at = STEPS.indexOf(step);
  return (
    <ol className="flex items-center gap-1" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            aria-current={i === at ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              i < at && 'text-ink-300',
              i === at && 'bg-forge-500/15 text-forge-400',
              i > at && 'text-ink-400',
            )}
          >
            {i < at && <Check size={11} />}
            {t(`step.${s}`)}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-3 bg-ink-700" />}
        </li>
      ))}
    </ol>
  );
}
