# Analisis Tayang Studio dan keputusan FrameForge

Dokumen ini merangkum analisis repo [Maru-Yasa/tayang-studio](https://github.com/Maru-Yasa/tayang-studio)
(versi 0.0.8, November 2026) dan bagaimana FrameForge membangun ide yang sama sebagai proyek yang
sepenuhnya gratis dan open source.

## Apa itu Tayang Studio

Aplikasi desktop (Tauri 2 + React 19, monorepo pnpm, ~61 ribu baris TS/Rust) yang membantu kreator
Indonesia membuat video motion untuk TikTok/Reels/Shorts tanpa menulis prompt. Aplikasi tidak punya AI
sendiri: agent milik pengguna (Claude Code, opencode, Gemini CLI, Codex, Antigravity, agent ACP lain)
dijalankan lewat ACP dan melakukan semua pembuatan.

### Arsitektur

| Bagian | Isi |
| --- | --- |
| `apps/desktop/src-tauri` | Rust: klien ACP buatan sendiri (`acp.rs`, ~1.700 baris), SQLite (`rusqlite`), penjadwal, proyek, media/ffmpeg, login (`auth.rs`), **billing** (`billing.rs`), telemetri, sinkron gaya dari API, proxy AI, engine "Your API" (mengunduh opencode). |
| `apps/desktop/src` | React: layar Chat, Videos, Style, Autopilot, Calendar, Agents (kanban), Settings, **Plans**, Social; komponen **UpgradeCard**, **GiftCode**, **Account**; i18n EN/ID; renderer A2UI v0.9. |
| `packages/shared` | Tipe bersama, termasuk `billing.ts`, `auth.ts`, `promo.ts`. |
| `packages/skills` | SKILL.md untuk agent (plugin Claude Code + preamble untuk agent lain). |
| API tertutup | `studio.tayang.app/api` (Hono di Cloudflare Workers, repo privat): login Google, paket, pembayaran, gaya bawaan, statistik instalasi. |

### Alur produk

1. Onboarding: sambutan → hubungkan agent → cek alat (Node 22+, FFmpeg, Chrome; disarankan ElevenLabs MCP, yt-dlp). Instalasi selalu lewat agent dan harus disetujui.
2. Chat proyek: Topik → Naskah → Gaya → Bangun → Render, pilihan sebagai kartu (A2UI), pratinjau 9:16 dengan scrubber frame dan "kirim frame ke chat".
3. Gaya: bawaan (dari API), ditiru dari link video (yt-dlp + ffmpeg + agent), atau buatan sendiri.
4. Autopilot: niche + gaya + jadwal, satu video sekaligus, mode otomatis; posting otomatis lewat layanan pihak ketiga.
5. Kalender, papan Agents, pemakaian agent (membaca token Claude Code lokal).

### Bagian berbayar / tertutup yang ditemukan

- Paket **Lite, Creator, Pro** (`screens/Plans.tsx`, `lib/billing.ts`, `src-tauri/src/billing.rs`, `components/UpgradeCard.tsx`).
- Pembayaran QRIS via SumoPod, atau lewat WhatsApp saat pembayaran online mati.
- Kode hadiah dengan hash machine-ID (`components/GiftCode.tsx`, `shared/src/promo.ts`).
- Login Google dan token di keychain OS (`auth.rs`).
- Telemetri instalasi harian dan PostHog (`telemetry.rs`, `lib/analytics.ts`).
- Gaya bawaan, niche dan suara diambil dari API tertutup; voiceover/cloud render direncanakan berbayar.

### Catatan lisensi

README Tayang menyebut "open-source", tetapi repo **tidak memiliki file LICENSE**. Tanpa lisensi,
kodenya secara hukum tetap "all rights reserved", sehingga **tidak boleh disalin**. Karena itu FrameForge
ditulis ulang dari nol: hanya konsep produk (yang tidak dilindungi hak cipta) yang dijadikan acuan.
Tidak ada kode, aset, logo, maskot (Oyen) atau teks dari Tayang yang dipakai.

## Keputusan FrameForge

| Topik | Tayang Studio | FrameForge |
| --- | --- | --- |
| Harga | Gratis + paket Lite/Creator/Pro | **Semua gratis**, tanpa menu pricing |
| Akun | Login Google opsional | **Tidak ada akun** |
| Server | API tertutup untuk login, paket, gaya, statistik | **Tidak ada server**; gaya bawaan ikut di aplikasi |
| Telemetri | Ping harian + PostHog | **Tidak ada** |
| Lisensi | Tidak ada file LICENSE | **MIT** |
| Klien ACP | Rust | TypeScript (lebih mudah diuji); Rust hanya meneruskan stdio |
| Penyimpanan | SQLite | File JSON (ditulis atomik) di folder app data |
| Pilihan untuk user | A2UI v0.9 | Blok ```` ```frameforge-options ```` (JSON sederhana) yang dirender sebagai kartu |
| Skill agent | Plugin Claude Code + preamble | Preamble di prompt pertama untuk semua agent |
| Autopilot | Ya, plus posting otomatis berbayar | Ya, posting tetap manual dengan pengingat |

## Belum ada (peta jalan)

- Papan kanban Agents dan panel pemakaian agent.
- Templat proyek per gaya (salinan proyek Remotion yang sudah jadi).
- Voiceover lewat ElevenLabs MCP milik pengguna.
- Mode latar belakang (tray) supaya autopilot jalan saat jendela ditutup.
- Auto-update dari GitHub Releases dan installer bertanda tangan.
