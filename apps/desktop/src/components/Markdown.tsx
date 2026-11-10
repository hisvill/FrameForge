import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openUrl } from '../lib/ipc';

/** Agent prose as GFM Markdown. Raw HTML is never rendered; remote images stay alt text. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a
              onClick={(e) => {
                e.preventDefault();
                if (href) void openUrl(href);
              }}
            >
              {children}
            </a>
          ),
          img: ({ alt }) => <span className="text-ink-400">[{alt || 'image'}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
