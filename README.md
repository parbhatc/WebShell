# WebShell

A self-hosted web dashboard for managing SSH servers. Connect to remote machines from your browser with an interactive terminal, file explorer, and built-in text editor.

**Repository:** [github.com/parbhatc/WebShell](https://github.com/parbhatc/WebShell)

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Server management** — Add, edit, and remove SSH servers from a dashboard
- **Browser terminal** — Interactive shell via WebSocket + xterm.js
- **File explorer** — Browse, upload, download, create, rename, and delete remote files over SFTP
- **File editor** — Edit text files in-browser with save (Ctrl+S), up to 1MB
- **Session memory** — Remembers your last folder per server across page refreshes
- **Authentication** — JWT access tokens with refresh token rotation (stay logged in)
- **Encrypted credentials** — SSH passwords and keys stored encrypted at rest

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React, Vite, Tailwind CSS, Zustand, xterm.js, Lucide icons |
| Backend | Express, Sequelize, SQLite |
| SSH | ssh2 (shell + SFTP with connection pooling) |
| Real-time | WebSocket (ws) |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm

### Installation

```bash
git clone https://github.com/parbhatc/WebShell.git
cd WebShell
npm install
```

### Configuration

Copy the example environment file and update the secrets:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret used to sign access tokens |
| `ENCRYPTION_KEY` | 32-character key for encrypting stored SSH credentials |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token lifetime (default: `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime (default: `30d`) |

Generate strong values before deploying:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Development

Start the frontend and API together:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:5173 |
| API | http://localhost:3001 |

Register an account, add a server, then click **Connect** to open the session workspace.

### Production build

```bash
npm run build
npm run preview    # preview the static frontend
npm run server:dev # run the API (use a process manager in production)
```

> **Note:** The SSH terminal requires a persistent WebSocket connection. Serverless platforms (e.g. Vercel) are not suitable for the full experience. Run the API on a VPS or local machine.

## Project structure

```
WebShell/
├── api/                  # Express API + WebSocket server
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   └── services/         # auth, SSH, SFTP, crypto
├── src/                  # React frontend
│   ├── components/       # SshTerminal, FileExplorer, FileEditor
│   ├── pages/            # Login, Dashboard, Workspace
│   └── stores/           # Zustand auth + server state
└── prisma/               # Database migrations (reference)
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (returns access + refresh tokens) |
| POST | `/api/auth/refresh` | Rotate tokens |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/servers` | List servers |
| POST | `/api/servers` | Add server |
| GET | `/api/servers/:id/files?path=/` | List remote files |
| GET | `/api/servers/:id/files/content?path=` | Read file for editor |
| PUT | `/api/servers/:id/files/content?path=` | Save file from editor |
| PUT | `/api/servers/:id/files/upload?path=` | Upload file (stream) |
| GET | `/api/servers/:id/files/download?path=` | Download file (stream) |
| WS | `/ws?token=&serverId=` | SSH terminal session |

## Security notes

- Change all default secrets in `.env` before exposing the app to a network
- Credentials are encrypted at rest, but the app still holds the keys — treat the host as trusted
- Use SSH keys instead of passwords when possible
- Restrict network access (VPN, firewall) if self-hosting on the public internet

## License

MIT
