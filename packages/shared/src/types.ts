/** Interface languages FrameForge ships with. */
export type UiLanguage = 'en' | 'id';

export type AgentId = 'claude' | 'opencode' | 'gemini' | 'codex' | 'custom';

export interface AgentInfo {
  id: AgentId;
  name: string;
  /** Command that starts the agent in ACP mode. */
  command: string[];
  /** Whether the agent's CLI was found on this computer. */
  installed: boolean;
  version?: string;
}

export type ToolId = 'node' | 'ffmpeg' | 'chrome' | 'ytdlp';

export interface ToolCheck {
  id: ToolId;
  required: boolean;
  found: boolean;
  version?: string;
  path?: string;
}

export type VideoFormat = '9:16' | '1:1' | '16:9';

export interface Settings {
  language: UiLanguage;
  defaultAgent: AgentId;
  customAgentCommand: string;
  workingFolder: string;
  autoMode: boolean;
  frameCheck: boolean;
  videoLanguage: string;
  format: VideoFormat;
  fps: number;
  onboarded: boolean;
}

export interface StyleBreakdown {
  camera: string;
  pacing: string;
  type: string;
  color: string;
  captions: string;
  transitions: string;
}

export type StyleSource = 'builtin' | 'copied' | 'yours';

export interface Style {
  id: string;
  name: string;
  source: StyleSource;
  description: string;
  breakdown: StyleBreakdown;
  /** The instructions the agent follows for this look. */
  prompt: string;
  /** For a copied style: the link it was studied from. */
  sourceUrl?: string;
  basedOn?: string;
  /** CSS gradient used as a stand-in thumbnail. */
  swatch: string;
  createdAt: string;
}

export type Step = 'topic' | 'script' | 'style' | 'build' | 'render';
export const STEPS: Step[] = ['topic', 'script', 'style', 'build', 'render'];

/** `frameforge.json`, written in every project folder. */
export interface ProjectManifest {
  id: string;
  title: string;
  topic?: string;
  styleId?: string;
  format: VideoFormat;
  fps: number;
  step: Step;
  createdAt: string;
  /** Command that renders the final video, run inside the project folder. */
  renderCommand?: string;
}

export interface Project extends ProjectManifest {
  folder: string;
  /** Newest `.mp4` in the project's `out/` folder. */
  latestRender?: string;
  renderedAt?: string;
  scheduledAt?: string;
  postedAt?: string;
}

export type ChatRole = 'user' | 'agent' | 'system';

export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface ToolCallPart {
  kind: 'tool';
  id: string;
  title: string;
  toolKind?: string;
  status: ToolStatus;
  detail?: string;
}

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface ThoughtPart {
  kind: 'thought';
  text: string;
}

export interface ImagePart {
  kind: 'image';
  path: string;
  caption?: string;
}

export type MessagePart = TextPart | ThoughtPart | ToolCallPart | ImagePart;

export interface ChatMessage {
  id: string;
  role: ChatRole;
  parts: MessagePart[];
  createdAt: string;
}

export interface Chat {
  id: string;
  title: string;
  projectId?: string;
  agent: AgentId;
  autoMode?: boolean;
  /** Set for chats an autopilot started. */
  autopilotId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

export interface PermissionRequest {
  requestId: string;
  chatId: string;
  title: string;
  command?: string;
  options: PermissionOption[];
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Autopilot {
  id: string;
  name: string;
  niche: string;
  styleId: string;
  agent: AgentId;
  /** Local times, `HH:MM`. One video per time. */
  times: string[];
  days: Weekday[];
  lengthSec: number;
  reviewFirst: boolean;
  paused: boolean;
  createdAt: string;
}

export type SlotState = 'planned' | 'making' | 'review' | 'ready' | 'failed' | 'skipped';

export interface AutopilotSlot {
  id: string;
  autopilotId: string;
  /** ISO time the video is due. */
  at: string;
  state: SlotState;
  projectId?: string;
  chatId?: string;
  error?: string;
}
