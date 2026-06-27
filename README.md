# Industrial CRM — Customer Follow-Up, Quotation & Sales Management System

A full-stack Progressive Web App (PWA) + Android/iOS app for industrial sales teams. Manage customers, meetings, quotations, stock, attendance with live GPS tracking, and leaves — all in one platform.

---

## 🗂 Project Structure

```
industrial-crm/
├── backend/          ← Node.js + Express + Prisma + SQLite/MySQL/PostgreSQL
│   ├── prisma/       ← DB schema + seed data
│   └── src/          ← Controllers, routes, middleware
├── frontend/         ← Next.js 14 + Tailwind CSS + PWA + Capacitor (Android + iOS)
│   ├── src/app/      ← 21 pages across all modules
│   ├── android/      ← Native Android Studio project
│   └── ios/           ← Native Xcode project
│   └── public/       ← PWA manifest, icons
└── README.md
```

---

## ✅ Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 LTS | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Bundled with Node.js |
| Android Studio | Latest | For Android APK only |
| JDK 17 | 17+ | For Android APK only |

---

## 🚀 Quick Start (Development)

> **This project is an npm workspace monorepo** — `backend` and `frontend` are managed together from a single root `package.json`. Always run `npm install` from the **project root** (this folder), never from inside `backend/` or `frontend/` individually, or dependencies like `@prisma/client` won't resolve correctly.

### 1. Install everything (run from the project root)

```bash
npm install
```

This installs and hoists dependencies for both `backend` and `frontend` in one step.

### 2. Set up the database

```bash
npm run db:setup
```

This runs Prisma's client generation, creates the SQLite database, and seeds it with demo data (admin user, sample customers, products, stock, and a sample follow-up).

**Default admin login after seeding:**
```
Email:    admin@company.com
Password: Admin@123
```

**Sample sales user:**
```
Email:    sales@company.com
Password: Sales@123
```

### 3. Start the backend (Terminal 1, from project root)

```bash
npm run dev:backend
```

Backend runs on **port 5000**.

### 4. Start the frontend (Terminal 2, from project root)

```bash
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Frontend runs on **port 3000**.

---

### Manual / per-workspace commands (advanced)

If you need to run a command for just one workspace (e.g. `prisma studio`), use the `--workspace` flag from the root rather than `cd`-ing into the folder:

```bash
npm run db:studio --workspace=backend
npm install some-package --workspace=backend
```

---

## 📱 Android & iOS Build

Native projects for **both platforms** have already been generated — `frontend/android/` (Gradle wrapper, manifest, source sets) and `frontend/ios/` (Xcode project, Info.plist). Both are configured with the Geolocation plugin and the permissions the spec requires (GPS for live attendance tracking, phone dialer for click-to-call, push notifications).

Because this is a dynamic, authenticated app (live API calls, role-based dashboards, live GPS map), both apps load your **deployed frontend URL** directly in a native WebView — the standard approach for Capacitor-wrapped SaaS apps — rather than bundling a static export.

### Step 1 — Point the app at your server

Edit `frontend/capacitor.config.ts`:

```ts
server: {
  androidScheme: 'https',
  url: 'https://your-deployed-frontend-url.com',  // ← your production URL
  // For local testing on a device, use your machine's LAN IP instead:
  // url: 'http://192.168.1.50:3000',
  cleartext: true,
},
```

### Step 2 — Sync

```bash
cd frontend
npx cap sync
```

### Step 3a — Android

```bash
npx cap open android
```
In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)** gives you a quick debug APK for testing. For a real release build:

1. Create a signing key (one time only — keep this file and password safe, you'll need the *same* key for every future update):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias industrial-crm -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In Android Studio: **Build → Generate Signed Bundle / APK** → choose APK → point it at `release.keystore` → build.
3. Output lands in `frontend/android/app/release/`.

This signed APK can be installed directly on any Android phone (the user just needs to allow "Install unknown apps" for whatever app they downloaded it through), or uploaded to the Google Play Console if you want it on the Play Store.

### Step 3b — iOS *(requires a Mac with Xcode)*

```bash
cd frontend/ios/App
pod install   # first time only — requires CocoaPods (gem install cocoapods)
cd ../..
npx cap open ios
```
In Xcode: select a signing team under **Signing & Capabilities**, then **Product → Archive** to build for the App Store, or run directly on a connected device/simulator with ⌘R.

> iOS builds can only be compiled on macOS — Xcode itself only runs there. Everything else (the web app, the Xcode project files, Info.plist permissions) is already prepared; the `pod install` + build step is the one part that has to happen on a Mac.

**Don't have a Mac?** A few practical options:
- **Borrow or rent one** — MacInCloud or MacStadium rent Mac access by the hour/month if you just need it for occasional builds.
- **A free Apple ID is enough to test on your own device** via Xcode's "Personal Team" signing — no paid account needed for that.
- **Distributing to your team** (beyond your own device) requires the **Apple Developer Program** ($99/year). Once enrolled, **TestFlight** is the easiest path — upload a build, invite up to 10,000 testers by email, no App Store review needed. Full App Store listing is a separate, optional step with its own review process.

### Android permissions already configured

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### iOS permissions already configured (`Info.plist`)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Industrial CRM uses your location to record GPS coordinates when you punch in/out and to share your live location with your manager while you're on the clock.</string>
```

---

## 🖥 Windows Desktop App (.exe)

Two options — pick whichever fits:

### Option A — PWA install (instant, no build step)

1. Run the frontend: `npm run dev` (or open your deployed URL)
2. Open Chrome or Edge → click the **install icon** in the address bar
3. Installs as a standalone Windows app immediately

### Option B — Electron .exe (downloadable installer)

A ready-to-build Electron wrapper lives in `desktop/` — same approach as the TMS Quotation Creator desktop build.

```bash
cd desktop
npm install
npm run build:win
```

Produces `Industrial CRM Setup 1.0.0.exe` (installer) and a portable `.exe` in `desktop/dist/`.

See [`desktop/README.md`](desktop/README.md) for full instructions, icon customization, and pointing it at your deployed server.

---

## 🗄 Switch to MySQL (Production)

The schema works with SQLite (zero-setup local dev) or MySQL (production). Edit `backend/.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/industrial_crm"
```

Edit `backend/prisma/schema.prisma`, change the datasource:
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

From the **project root**:
```bash
npm run db:setup
```

> PostgreSQL also works if you'd rather use it — same steps, just `provider = "postgresql"` and a `postgresql://` URL.

---

## 🐳 Hosting It (Production Deployment)

The whole stack — MySQL, the API, the web app, and an nginx reverse proxy with HTTPS — runs from one `docker-compose.yml`. This is the path I'd recommend: cheapest, fewest moving parts, works the same on any VPS provider.

### What you need

- A VPS with Docker installed — DigitalOcean, Hetzner, AWS Lightsail, or similar. ₹400–800/month (~$5–10) is plenty for a small sales team.
- A domain name (or subdomain) pointed at the VPS — e.g. `crm.yourcompany.com`.

### Step 1 — Get a server and point your domain at it

1. Spin up a VPS running Ubuntu 22.04. Note its public IP address.
2. In your domain registrar's DNS settings, add an **A record**: `crm` (or whatever subdomain) → the VPS's IP address. DNS propagation can take a few minutes to a few hours.
3. SSH into the server and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # log out and back in for the group change to apply
   ```

### Step 2 — Get the project onto the server

Upload the `industrial-crm` folder (e.g. via `scp -r industrial-crm/ user@your-server-ip:~/`), or push it to a private Git repo and `git clone` it on the server.

### Step 3 — Switch the database to MySQL

This is a required step before building — the Docker setup uses MySQL, but the project defaults to SQLite for easy local dev.

Edit `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql"   // ← change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 4 — Set real secrets

Edit `docker-compose.yml` and change every placeholder value:
- `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` (and matching `DATABASE_URL` password)
- `JWT_SECRET` — generate one with `openssl rand -base64 48`
- `FRONTEND_URL` — set to `https://crm.yourcompany.com` (your real domain)

### Step 5 — Build and start everything

```bash
cd industrial-crm
docker compose up -d --build
```

The backend container automatically runs the database migration and seed on its first start (creating the admin login below) — no extra step needed. Check `docker compose logs backend` if you want to watch it happen.

At this point `http://your-domain-or-ip` should load the app over plain HTTP. `nginx/nginx.conf` is already routing `/api/*` to the backend and everything else to the frontend.

### Step 6 — Add HTTPS (free, via Let's Encrypt)

```bash
mkdir -p nginx/certbot-www nginx/certbot-certs
docker run -it --rm \
  -v $(pwd)/nginx/certbot-www:/var/www/certbot \
  -v $(pwd)/nginx/certbot-certs:/etc/letsencrypt \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d crm.yourcompany.com --email you@yourcompany.com --agree-tos
```

Then uncomment the `HTTPS` server block at the bottom of `nginx/nginx.conf` (and the HTTP→HTTPS redirect near the top), and restart nginx:
```bash
docker compose restart nginx
```

Certificates renew automatically for 90 days; set a monthly cron job to re-run the certbot command above to keep it current.

### Updating later

```bash
git pull   # or re-upload changed files
docker compose up -d --build
```

### Services in this setup

| Service | What it does |
|---|---|
| `mysql` | Database — data persists in a Docker volume |
| `backend` | Express API, internal port 5000 (not exposed publicly — only nginx talks to it) |
| `frontend` | Next.js app, internal port 3000 (same — only nginx talks to it) |
| `nginx` | The only thing exposed on ports 80/443 — terminates HTTPS and routes traffic |

---

## 📋 Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL="file:./dev.db"              # SQLite (dev) or PostgreSQL URL
JWT_SECRET="change-this-in-production"
JWT_EXPIRES_IN="7d"
PORT=5000
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=Industrial CRM
```

---

## 🔑 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — create/edit/delete/approve all records, view all users, access all dashboards |
| **Sales** | Create/edit only — no delete, submit requests for approval, view shared customer DB |

---

## 📦 Module Overview

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/dashboard` | KPIs, charts, overdue alerts |
| Customers | `/customers` | Company DB with duplicate detection |
| Meetings | `/meetings` | Follow-up tracking with 10-stage pipeline |
| Quotations | `/quotations` | TMS letterhead format — customer auto-fill, per-item discount/category/delivery, PDF export |
| Products | `/products` | Product master with category, HSN code, product ref |
| Stock | `/stock` | Inventory with 13-column Excel import, category auto-mapping, stock-value KPI |
| Attendance | `/attendance` | GPS check-in/out **with live tracking while on the clock** |
| Leaves | `/leaves` | Leave requests with approval workflow |
| Admin — Live tracking | `/admin/live-tracking` | Live map of checked-in employees + movement trail (Admin only) |
| Admin — Categories | `/admin/categories` | Product/stock category management with color coding (Admin only) |
| Admin — Users | `/admin/users` | User management (Admin only) |
| Admin — Approvals | `/admin/approvals` | Approval queue (Admin only) |
| Admin — Reports | `/admin/reports` | Real PDF/Excel/CSV export for all 8 report types (Admin only) |
| Admin — Activity | `/admin/activity` | Full audit log (Admin only) |

---

## 📍 Live GPS Attendance Tracking

When an employee punches in, the browser's location API (`watchPosition`) starts sending a GPS ping to the server roughly every 30 seconds for as long as the app/tab stays open. Punching out stops it. Admins see everyone currently checked in on a live map (`/admin/live-tracking`, OpenStreetMap via Leaflet — no API key needed), with a per-employee movement trail for the day.

**Important limitation:** this is **foreground-only**. A website — even installed as a PWA or wrapped in Capacitor — cannot reliably track location once the app is backgrounded, especially on iOS. True background tracking needs a native background-location plugin (e.g. a Capacitor community plugin) with explicit "Always" location permission and an App Store privacy justification. The current build does not include this; `Info.plist` only requests "When In Use" accordingly. Treat this as the next step if always-on tracking becomes a hard requirement.

**Why polling instead of WebSockets:** the live map refreshes via polling (every 15s) rather than a persistent WebSocket connection. This keeps the deployment simple (no extra Socket.io infra, works behind any reverse proxy/load balancer without sticky sessions) at the cost of being slightly less real-time. Swap in Socket.io if sub-15-second updates become necessary.

---

## 🧾 Quotation Letterhead Format

Quotations follow the TMS letterhead format: `TMS/{year}/{0001}` numbering, a To/Kind-Attn/Enquiry-Ref block, per-line Category/MOQ/Discount%/Net-Price/Delivery, a commercial-terms strip (Sales Tax, Payment Terms, Validity, Delivery Charges), and a signature block. Selecting a customer auto-fills the letterhead (name, address, contact, designation) from their CRM record — every field stays editable afterward. Per-line pricing: `Net = Rate × (1 − Discount%)`, `Amount = Net × MOQ`.

---

## 🛠 Scripts Reference

All commands below are run from the **project root**.

### Root (workspace-level)

```bash
npm install              # Install + hoist dependencies for backend and frontend
npm run setup             # install + db:setup in one shot (first-time setup)
npm run db:setup          # Generate Prisma client + push schema + seed demo data
npm run dev:backend       # Start backend with hot reload (port 5000)
npm run dev:frontend      # Start frontend dev server (port 3000)
npm run build:frontend    # Production build of the frontend
```

### Per-workspace (advanced)

```bash
npm run db:generate --workspace=backend  # Regenerate Prisma client
npm run db:push --workspace=backend      # Sync schema to database
npm run db:seed --workspace=backend      # Seed demo data only
npm run db:studio --workspace=backend    # Open Prisma Studio (DB GUI)
npm run start --workspace=backend        # Start backend in production mode
npm run start --workspace=frontend       # Serve frontend production build
```

---

## 📁 Key Files

```
backend/
  src/controllers/quotations.controller.js  ← PDF generation (PDFKit)
  src/middleware/auth.js                    ← JWT + RBAC
  prisma/schema.prisma                      ← Full DB schema (15 models)
  prisma/seed.js                            ← Demo data seed

frontend/
  src/app/(dashboard)/                      ← All 18 app pages
  src/components/Sidebar.tsx                ← Navigation
  src/lib/api.ts                            ← All API calls
  src/store/auth.store.ts                   ← Zustand auth state
  public/manifest.json                      ← PWA manifest
  capacitor.config.ts                       ← Android APK config
```

---

## 🔔 Push Notifications Setup (Optional)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add your app and download `google-services.json`
3. Place `google-services.json` in `frontend/android/app/`
4. Add Firebase config to `frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## 🎨 Tech Stack

- **Frontend:** React 18, Next.js 14, Tailwind CSS, Zustand, React Query, Recharts, Leaflet (live tracking map)
- **Backend:** Node.js 20, Express.js, Prisma ORM
- **Database:** SQLite (dev) / MySQL or PostgreSQL (production)
- **Auth:** JWT, bcrypt, Role-Based Access Control
- **Documents:** PDFKit (quotation PDFs, report PDFs), xlsx (Excel import/export)
- **Mobile:** Capacitor (Android + iOS native projects included)
- **PWA:** next-pwa (Windows installable app)

---

Built for Tulips Machining Solutions — Industrial sales management platform.
