import type { Style, ToolId } from '@frameforge/shared';

/** First message of a new project chat. */
export function startProjectPrompt(opts: { title: string; idea?: string; style?: Style; lengthSec: number; format: string }): string {
  return [
    `Let's make a new ${opts.lengthSec}-second ${opts.format} video called "${opts.title}".`,
    opts.idea ? `My idea: ${opts.idea}` : 'I don\'t have a topic yet. Suggest some.',
    opts.style ? `Use the "${opts.style.name}" style.` : 'Suggest a style that fits.',
    'Start at the topic step.',
  ].join(' ');
}

/** Asks the agent for topic ideas without a project. */
export function topicIdeasPrompt(niche: string, styles: Style[]): string {
  const names = styles.map((s) => `"${s.name}"`).join(', ');
  return `Suggest 5 short-video topics about ${niche || 'anything surprising and true'}. They should fit one of these styles: ${names}. Offer them as option cards.`;
}

/** Plain-words install request; the agent picks the commands for this OS. */
export function installPrompt(tool: ToolId, os: string): string {
  const what: Record<ToolId, string> = {
    node: 'Node.js 22 or newer, then confirm `node --version` works',
    ffmpeg: 'FFmpeg, then confirm `ffmpeg -version` works',
    chrome: 'Google Chrome or Chromium, then confirm it is installed',
    ytdlp: 'yt-dlp, then confirm `yt-dlp --version` works',
  };
  return `Install ${what[tool]} on this computer (${os}) with the system package manager. Keep it short and tell me when it is done.`;
}

/** Studies a video link and writes a style, without keeping the footage. */
export function copyStylePrompt(url: string, outFile: string): string {
  return [
    `Study the look of this video and write it down as a reusable style: ${url}`,
    '',
    'Steps:',
    '1. Download it into this folder with yt-dlp (lowest quality that is still readable).',
    '2. Sample about 40 frames with ffmpeg: at scene changes (`select=gt(scene\\,0.3)`) plus one every 2 seconds. Tile them into contact sheets to save tokens.',
    '3. Study the frames with their timestamps: camera movement, pacing (shot length), typography, color, captions, transitions.',
    `4. Write the result as JSON to \`${outFile}\` with exactly these keys: name, description, camera, pacing, type, color, captions, transitions, prompt. \`prompt\` is the instructions another agent follows to recreate the look in a new video (not the content).`,
    '5. Delete the downloaded video and the frames. Copy the look, never the footage.',
  ].join('\n');
}

/** One fresh topic for an autopilot slot, then build and render it. */
export function autopilotPrompt(opts: { niche: string; style?: Style; lengthSec: number; pastTitles: string[] }): string {
  return [
    `You are making a video on a schedule, with nobody watching. Pick ONE fresh motion-design topic about: ${opts.niche}.`,
    opts.pastTitles.length ? `Do not repeat these earlier videos: ${opts.pastTitles.map((t) => `"${t}"`).join(', ')}.` : '',
    opts.style ? `Use the "${opts.style.name}" style.` : '',
    `Make it ${opts.lengthSec} seconds long. Don't ask me anything: decide yourself, go through all five steps, run the frame check and render out/video.mp4.`,
  ]
    .filter(Boolean)
    .join(' ');
}
