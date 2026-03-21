# myOS

One inbox for everything. iMessage and Gmail in a single app with AI-powered daily digests.

[myos.vercel.app](https://myos.vercel.app)

## Features

- **Unified Inbox** — iMessage and Gmail in a single timeline
- **AI Digest** — Daily summary of what needs your attention (Claude, OpenAI, or Gemini)
- **Smart Organization** — Tags, priority sorting, and filters
- **Pinned Dashboard** — Spatial canvas for pinned conversations and clusters
- **Search** — Find any conversation by name or message content

## Install

Requires **macOS with Apple Silicon** (M1 or later).

1. Download the latest `.dmg` from [Releases](https://github.com/phobopan/myOS/releases/latest)
2. Open the DMG and drag **myOS** to Applications
3. If macOS says the app is "damaged", open Terminal and run:
   ```
   xattr -cr /Applications/myOS.app
   ```
4. Open the app and grant **Full Disk Access** when prompted (required for iMessage)
5. Sign in to **Gmail** and connect an **AI provider** (Claude, OpenAI, or Gemini) during setup

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run package:mac:arm64
```

## License

MIT
