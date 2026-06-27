# Industrial CRM — Windows Desktop App

A lightweight Electron wrapper that packages the Industrial CRM web app into a native Windows `.exe` installer and portable executable — the same approach used for the TMS Quotation Creator desktop build.

---

## How it works

This is **not** a separate codebase — it's a thin Electron shell that opens the same Next.js frontend (`../frontend`) in a desktop window. You still run the backend + frontend servers (locally or deployed), and this wrapper just gives users a native `.exe` to double-click instead of opening a browser.

---

## 🚀 Quick Start (Development)

```bash
cd desktop
npm install

# Make sure backend (port 5000) and frontend (port 3000) are running first, then:
npm start
```

This opens the CRM in a native window pointing at `http://localhost:3000`.

---

## 📦 Build the Windows .exe

### Step 1 — Point it at your deployed app

Edit `desktop/main.js` and set your production URL:

```js
const APP_URL = process.env.CRM_URL || 'https://your-deployed-frontend-url.com';
```

Or leave it pointing at `http://localhost:3000` if users will run the backend locally too (e.g. on an office LAN server).

### Step 2 — Replace the icon (recommended)

Replace `desktop/icon.ico` with your own branded 256×256 `.ico` file. Use [icoconvert.com](https://icoconvert.com) or similar to convert a PNG logo.

### Step 3 — Build

```bash
cd desktop
npm install
npm run build:win
```

This produces two files in `desktop/dist/`:

| File | Description |
|------|--------------|
| `Industrial CRM Setup 1.0.0.exe` | Full installer (NSIS) — creates Start Menu + Desktop shortcuts |
| `Industrial CRM 1.0.0.exe` (portable) | Single-file portable .exe — no install needed |

### Step 4 — Distribute

Share the `.exe` directly, or host it on your internal server / file share for the sales team to download.

---

## 🖥 Alternative: PWA Install (no build needed)

If you don't need a standalone `.exe`, users can install the app directly from Chrome/Edge on Windows with one click — no Electron build required. See the main project [README.md](../README.md#-windows-pwa-install) for details.

---

## ⚠️ Build environment note

`electron` and `electron-builder` download large platform binaries from GitHub/Google's CDN during `npm install`. This requires unrestricted internet access — run this build step on your own development machine (not inside a network-sandboxed CI environment) for the install to succeed.

---

## Customization

| What | Where |
|------|-------|
| Window size | `desktop/main.js` → `BrowserWindow` width/height |
| App name shown in title bar | `desktop/main.js` → `title: 'Industrial CRM'` |
| App ID / Product name in installer | `desktop/package.json` → `build.appId`, `build.productName` |
| Icon | `desktop/icon.ico` |
| Target server URL | `desktop/main.js` → `APP_URL` |
