export interface OptionCard {
  label: string;
  description?: string;
  value: string;
}

export interface OptionsBlock {
  question?: string;
  options: OptionCard[];
}

export type Segment = { kind: 'markdown'; text: string } | { kind: 'options'; block: OptionsBlock } | { kind: 'pending' };

const FENCE = /```frameforge-options\s*\n([\s\S]*?)```/g;

function parseBlock(raw: string): OptionsBlock | null {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.options)) return null;
    const options: OptionCard[] = data.options
      .filter((o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object')
      .map((o: Record<string, unknown>) => ({
        label: String(o.label ?? o.value ?? '').slice(0, 120),
        description: typeof o.description === 'string' ? o.description : undefined,
        value: String(o.value ?? o.label ?? ''),
      }))
      .filter((o: OptionCard) => o.label && o.value);
    if (!options.length) return null;
    return { question: typeof data.question === 'string' ? data.question : undefined, options };
  } catch {
    return null;
  }
}

/**
 * Splits agent text into Markdown and option-card blocks. A block that is still streaming
 * (opened but not closed) becomes `pending`; one that doesn't parse stays as Markdown.
 */
export function splitOptions(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(FENCE)) {
    const before = text.slice(last, m.index);
    if (before.trim()) out.push({ kind: 'markdown', text: before });
    const block = parseBlock(m[1]);
    out.push(block ? { kind: 'options', block } : { kind: 'markdown', text: m[0] });
    last = (m.index ?? 0) + m[0].length;
  }
  let rest = text.slice(last);
  const open = rest.indexOf('```frameforge-options');
  if (open >= 0) {
    if (rest.slice(0, open).trim()) out.push({ kind: 'markdown', text: rest.slice(0, open) });
    out.push({ kind: 'pending' });
    rest = '';
  }
  if (rest.trim()) out.push({ kind: 'markdown', text: rest });
  return out;
}
