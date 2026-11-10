import type { PermissionRequest } from '@frameforge/shared';
import { ShieldAlert } from 'lucide-react';
import { useT } from '../i18n';
import { useChats } from '../state/chat';
import { Button } from './ui';

export function PermissionCard({ req }: { req: PermissionRequest }) {
  const t = useT();
  const answer = useChats((s) => s.answerPermission);
  const pick = (kind: string) => req.options.find((o) => o.kind === kind)?.optionId ?? null;
  const allow = pick('allow_once');
  const always = pick('allow_always');
  const deny = pick('reject_once');
  return (
    <div className="rounded-xl border border-forge-500/40 bg-forge-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert size={16} strokeWidth={1.5} className="text-forge-400" />
        {t('perm.title')}
      </div>
      <div className="mt-1 text-sm text-ink-300">{req.title}</div>
      {req.command && <pre className="selectable mt-2 overflow-x-auto rounded-lg bg-ink-950 p-2.5 font-mono text-xs text-ink-100">{req.command}</pre>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={!allow} onClick={() => answer(req.requestId, allow)}>
          {t('perm.allow')}
        </Button>
        {always && (
          <Button size="sm" onClick={() => answer(req.requestId, always)}>
            {t('perm.always')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => answer(req.requestId, deny)}>
          {t('perm.deny')}
        </Button>
      </div>
    </div>
  );
}
