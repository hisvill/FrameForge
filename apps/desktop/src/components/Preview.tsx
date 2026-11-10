import type { Project } from '@frameforge/shared';
import { CalendarPlus, ChevronLeft, ChevronRight, Clapperboard, FolderOpen, ImageUp, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { fileUrl, ipc, revealPath } from '../lib/ipc';
import { fmtTime } from '../lib/time';
import { Button } from './ui';

const aspect: Record<string, string> = { '9:16': 'aspect-[9/16]', '1:1': 'aspect-square', '16:9': 'aspect-video' };

export function Preview({ project, onSendFrame, onSchedule }: { project: Project; onSendFrame: (path: string, time: number) => void; onSchedule: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const fps = project.fps || 30;
  const src = project.latestRender ? `${fileUrl(project.latestRender)}?v=${encodeURIComponent(project.renderedAt ?? '')}` : null;

  const step = (sec: number) => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(Math.max(0, v.currentTime + sec), v.duration || 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('textarea,input')) return;
      if (e.key === 'ArrowLeft') step(e.shiftKey ? -1 : -1 / fps);
      if (e.key === 'ArrowRight') step(e.shiftKey ? 1 : 1 / fps);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sendFrame = async () => {
    if (!project.latestRender) return;
    setBusy(true);
    try {
      const rel = project.latestRender.slice(project.folder.length + 1);
      const path = await ipc.extractFrame(project.folder, rel, time);
      onSendFrame(path, time);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-ink-800 bg-ink-900">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">{t('preview.title')}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onSchedule} title={t('preview.schedule')}>
            <CalendarPlus size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => revealPath(project.folder)} title={t('preview.open')}>
            <FolderOpen size={14} />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-4">
        <div className={`${aspect[project.format] ?? aspect['9:16']} w-full max-h-[62vh] overflow-hidden rounded-xl border border-ink-700 bg-black`}>
          {src ? (
            <video
              ref={video}
              key={src}
              src={src}
              className="h-full w-full object-contain"
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
            />
          ) : (
            <div className="dither flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs text-ink-400">
              <Clapperboard size={28} strokeWidth={1.25} />
              {t('preview.none')}
            </div>
          )}
        </div>
        {src && (
          <>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1 / fps}
              value={time}
              onChange={(e) => {
                if (video.current) video.current.currentTime = Number(e.target.value);
              }}
              className="mt-3 w-full accent-orange-500"
              aria-label="Scrubber"
            />
            <div className="mt-1 flex w-full items-center justify-between">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => step(-1 / fps)} aria-label="Previous frame">
                  <ChevronLeft size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => (playing ? video.current?.pause() : video.current?.play())} aria-label="Play">
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => step(1 / fps)} aria-label="Next frame">
                  <ChevronRight size={14} />
                </Button>
              </div>
              <span className="font-mono text-[11px] text-ink-400">
                {fmtTime(time)} · f{Math.round(time * fps)}
              </span>
            </div>
            <Button className="mt-3 w-full" onClick={sendFrame} disabled={busy}>
              <ImageUp size={14} /> {t('preview.sendFrame')}
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
