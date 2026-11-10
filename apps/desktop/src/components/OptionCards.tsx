import type { OptionsBlock } from '@frameforge/skills';
import { ArrowRight } from 'lucide-react';

export function OptionCards({ block, disabled, onPick }: { block: OptionsBlock; disabled?: boolean; onPick: (value: string) => void }) {
  return (
    <div className="my-2 space-y-2">
      {block.question && <div className="text-xs font-medium text-ink-300">{block.question}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {block.options.map((o, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onPick(o.value)}
            className="group flex items-start justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3 text-left transition-colors hover:border-forge-500/70 hover:bg-ink-800 disabled:opacity-50"
          >
            <span>
              <span className="block text-sm font-medium text-ink-100">{o.label}</span>
              {o.description && <span className="mt-0.5 block text-xs text-ink-400">{o.description}</span>}
            </span>
            <ArrowRight size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-400 group-hover:text-forge-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
