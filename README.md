# FrameForge

**Studio video motion yang 100% gratis dan open source.** FrameForge memandu kamu dari ide sampai video
motion siap posting (TikTok, Reels, Shorts) tanpa perlu menulis prompt. FrameForge memilih topik, menulis
naskah dan mengurus prompt-nya, sementara **agent AI milikmu sendiri** (Claude Code, opencode, Gemini CLI,
Codex, atau agent ACP lain) yang membangun videonya.

- Tidak ada menu pricing, paket berbayar, akun, login, kode hadiah, atau pembayaran.
- Tidak ada telemetri atau pelacakan. Semua data tersimpan di komputer ini.
- Tidak ada server tertutup: tidak ada API yang wajib, semua fitur jalan offline (agent-mu tetap butuh internet).
- Lisensi MIT.

> *English:* FrameForge is a free, open-source (MIT) desktop app that guides creators from idea to finished
> motion video. Your own ACP agent does the building. No pricing, no accounts, no telemetry.

## Fitur

| Fitur | Keterangan |
| --- | --- |
| **Onboarding** | 3 langkah: sambutan, hubungkan agent (deteksi otomatis), cek alat (Node.js, FFmpeg, Chrome, yt-dlp). Alat yang belum ada dipasang *lewat agent*, dan setiap perintah harus kamu setujui. |
| **Chat proyek video** | Lima langkah: Topik → Naskah → Gaya → Bangun → Render. Pilihan muncul sebagai kartu yang bisa diklik, perubahan cepat lewat chip ("Tempo lebih cepat", "Jadikan 15 dtk"). |
| **Chat bebas** | Minta ide, ketik `@` untuk melampirkan video sebagai konteks. |
| **Pratinjau** | Pemutar 9:16, langkah per frame (← →, Shift untuk 1 detik), scrubber, *Kirim frame ke chat*. |
| **Kartu izin** | Setiap perintah yang diminta agent tampil dulu dengan Izinkan / Tolak. Mode Otomatis bisa dinyalakan per chat. |
| **Gaya** | 4 gaya bawaan, tulis gayamu sendiri, salin/ubah/hapus, dan **tiru gaya dari link video** (agent mempelajari frame lalu menghapus videonya). |
| **Video** | Galeri semua proyek: Semua, Dikerjakan, Sudah dirender, Terjadwal. |
| **Kalender** | Jadwalkan video, geser antar hari, tandai sudah diposting, notifikasi pengingat. |
| **Autopilot** | Niche + gaya + jadwal (hari & jam). FrameForge membuat video sendiri selama aplikasi terbuka, dengan opsi "tinjau dulu". |
| **Cek frame** | Agent merender still tiap adegan, mengecek teks bertumpuk/terpotong, memperbaiki, baru bilang "Frames checked". |
| **Dwibahasa** | Antarmuka English dan Bahasa Indonesia; agent diminta membalas dalam bahasa antarmuka. |

## Cara kerja

```
┌──────────────── FrameForge (Tauri) ────────────────┐
│  React UI                                          │
│   ├─ klien ACP (TypeScript, JSON-RPC 2.0)          │──stdio──▶  agent milikmu
│   ├─ skill FrameForge (dikirim di prompt pertama)  │           (claude-agent-acp, opencode acp,
│   └─ autopilot & pengingat                         │            gemini --experimental-acp, codex-acp)
│  Rust                                              │                │
│   ├─ menjalankan proses agent & meneruskan stdio   │                ▼
│   ├─ data aplikasi (file JSON di folder app data)  │      folder proyek: frameforge.json,
│   └─ proyek, deteksi alat, ambil frame (ffmpeg)    │      kode Remotion, out/video.mp4
└────────────────────────────────────────────────────┘
```

- FrameForge **tidak punya AI sendiri.** Semua pembuatan dan instalasi berjalan lewat agent-mu melalui
  [Agent Client Protocol](https://agentclientprotocol.com).
- Setiap video adalah folder di *folder kerja* (default `~/Videos/FrameForge`) berisi `frameforge.json`
  dan hasil render di `out/`. Agent hanya bekerja di folder itu; akses file lewat ACP dibatasi ke dalamnya.
- Instruksi untuk agent ada di [`packages/skills/skills/frameforge/SKILL.md`](packages/skills/skills/frameforge/SKILL.md)
  dan dikirim di awal setiap sesi, jadi konfigurasi global agent-mu tidak diubah.
- Mesin render bawaan: Remotion. Agent boleh memakai HyperFrames atau HTML + ffmpeg selama hasilnya `out/video.mp4`.

## Menjalankan dari source

Kebutuhan: Node 22+, pnpm, Rust stable, dan [dependensi sistem Tauri 2](https://v2.tauri.app/start/prerequisites/).

```
pnpm install
pnpm dev          # aplikasi desktop (Vite + Tauri)
```

Hanya ingin melihat UI di browser? `pnpm --filter @frameforge/desktop dev` lalu buka http://localhost:1420.
Di browser, FrameForge memakai backend dan agent **demo** sehingga alurnya bisa dicoba tanpa Tauri.

Cek semuanya:

```
pnpm typecheck && pnpm test
cd apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Build installer: `pnpm build` (hasil di `apps/desktop/src-tauri/target/release/bundle`).

## Struktur

```
apps/desktop/          @frameforge/desktop  Tauri 2 + React 19 + Tailwind 4
  src/lib/acp.ts         klien ACP
  src/state/             zustand: app (pengaturan, gaya, proyek, jadwal) dan chat (sesi agent)
  src/screens/           Onboarding, Chat, Videos, Style, Calendar, Autopilot, Settings
  src-tauri/src/         agent.rs, store.rs, projects.rs, system.rs, paths.rs
packages/shared/       @frameforge/shared   tipe dan logika jadwal autopilot
packages/skills/       @frameforge/skills   SKILL.md, prompt, gaya bawaan, parser kartu pilihan
docs/                  analisis dan panduan pengembangan
```

## Privasi

FrameForge tidak mengirim apa pun ke server mana pun. Yang keluar dari komputer ini hanyalah apa yang
dikirim agent-mu ke penyedia AI-nya sendiri, dan unduhan video yang kamu minta saat meniru gaya.

## Lisensi

[MIT](LICENSE). Bebas dipakai, diubah dan didistribusikan, termasuk untuk keperluan komersial.
