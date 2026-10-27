# Taskly — Local Development Setup

This guide gets both the **Node.js backend** (port 8080) and the **React/Vite frontend** (port 3030) running on your machine, connected to a local MySQL database.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | comes with Node |
| MySQL | 8.x | https://dev.mysql.com/downloads/ or Homebrew `brew install mysql` |
| VS Code | latest | https://code.visualstudio.com |

---

## Step 1 — Clone / open in VS Code

```bash
# If you haven't already cloned:
git clone https://github.com/prashilager24-hub/taskly.git
cd taskly

# Open in VS Code
code .
```

---

## Step 2 — Set up the database locally

### 2a. Start MySQL and create the database

```sql
-- In MySQL CLI or Workbench:
CREATE DATABASE IF NOT EXISTS utilization CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'taskly'@'localhost' IDENTIFIED BY 'taskly_local';
GRANT ALL PRIVILEGES ON utilization.* TO 'taskly'@'localhost';
FLUSH PRIVILEGES;
```

### 2b. Import the production dump

Export a dump from the production server and import it:

```bash
# On production server — export:
mysqldump -u <prod_user> -p utilization > utilization_dump.sql

# On your local machine — import:
mysql -u taskly -ptaskly_local utilization < utilization_dump.sql
```

> **Tip:** If you don't have prod access yet, ask your team for a sanitised dump (personal data removed). The schema alone is enough to start.

---

## Step 3 — Configure the backend `.env`

```bash
cd nodejs-backend
cp .env.local.example .env
```

Now open `nodejs-backend/.env` and fill in:

```env
DB_USER=taskly          # or root — whatever user you created above
DB_PASSWORD=taskly_local  # the password you set above
JWT_SECRET=             # paste output of: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Everything else can stay at defaults for local dev.

---

## Step 4 — Install dependencies

```bash
# From the repo root — installs everything:
npm run install:all

# Or manually:
cd nodejs-backend && npm install
cd ../frontend    && npm install
```

---

## Step 5 — Run both servers

### Option A — One command from root (recommended)

```bash
# From repo root:
npm run dev
```

This starts both servers simultaneously:
- 🔵 **API** → http://localhost:8080  (Node.js / Express)
- 🟢 **Frontend** → http://localhost:3030  (Vite / React)

### Option B — Two separate terminals

```bash
# Terminal 1 — backend:
cd nodejs-backend
npm run dev

# Terminal 2 — frontend:
cd frontend
npm run dev
```

---

## How it works (no CORS issues)

The Vite dev server proxies all API calls to the backend automatically:

```
Browser → http://localhost:3030/t2.0/authentificationUtilization/*
                   ↓  Vite proxy
             http://localhost:8080/t2.0/authentificationUtilization/*
```

This means **no changes needed in the frontend** — it uses the same relative URLs it uses in production.

---

## Step 6 — Verify it's working

1. Open http://localhost:3030 in your browser
2. Try to log in — if it works, the DB connection is good
3. Check the backend logs in the terminal — you'll see each request

---

## VS Code recommended extensions

Install these for the best experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "PKief.material-icon-theme"
  ]
}
```

Or just install the **"Taskly Workspace"** — open the repo in VS Code and it will suggest them automatically (see `.vscode/extensions.json`).

---

## Troubleshooting

### ❌ `Error: connect ECONNREFUSED 127.0.0.1:3306`
MySQL isn't running. Start it:
```bash
# macOS (Homebrew):
brew services start mysql

# Windows:
net start mysql

# Linux:
sudo systemctl start mysql
```

### ❌ `JWT_SECRET must be at least 32 characters`
You left `JWT_SECRET` as the placeholder in `.env`. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### ❌ `Cannot find module 'tsx'`
```bash
cd nodejs-backend && npm install
```

### ❌ Frontend shows blank page / network errors
Check that the backend is running on port 8080 (`npm run dev:api`). The proxy won't forward if the target is down.

### ❌ `DB_USER is required` or similar Zod error
Your `nodejs-backend/.env` file is missing or has placeholder values. Check Step 3.

---

## Ports at a glance

| Service | Port | URL |
|---------|------|-----|
| Node.js API | 8080 | http://localhost:8080/health |
| React/Vite | 3030 | http://localhost:3030 |
| MySQL | 3306 | localhost:3306 |

---

## Sharing with your college teammate

Once everything works locally, your teammate can run the same steps. They need:
1. Git access to the repo (add them as collaborator on GitHub)
2. A copy of the DB dump (share via a private link or direct transfer)
3. Their own `.env` file (copy `.env.local.example`, fill in DB details)

That's it — they'll be running the same stack in minutes.

---

## Next steps after local testing

1. ✅ Test all features locally
2. 🔨 Make Access Management + other FE changes
3. 🚀 Deploy backend to Railway / Render / EC2
4. 🌐 Deploy frontend to Vercel (connect repo, set `VITE_API_URL` env var if needed)
