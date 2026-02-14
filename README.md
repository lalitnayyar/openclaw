# OpenClaw Mission Control Dashboard

OpenClaw Mission Control is an agents dashboard for monitoring and managing your CrewAI, LangGraph, BeeAI, and OpenClaw agents, along with the OpenClaw admin client. It provides a mission-control style interface inspired by production agent operations consoles.

This repository contains:

- **backend/** – FastAPI service exposing agent, task, heartbeat, alert, and performance endpoints.
- **dashboard/** – React + Vite + TypeScript UI for the mission-control dashboard.
- **scripts/** – Installation and deployment helpers for Azure Ubuntu VMs.
- **install-readme.md** – Detailed install guide for deploying to an Azure VM (no Docker).

---

## Features

- **Agents overview**
  - Left-hand rail listing all configured agents (CrewAI, LangGraph, BeeAI, OpenClaw, Admin).
  - Status indicators (online / busy / offline / error) with colored dots.
  - Last heartbeat timestamps and current task IDs.

- **Mission-control layout**
  - Three-column layout:
    - Left: Agents list and quick status.
    - Center: Tabs for Crons, Decisions, Signals, Costs, Performance, Architecture.
    - Right: Alerts panel + detailed view for a selected agent.

- **Crons / heartbeats tab**
  - Shows recent heartbeat jobs per agent.
  - Status pills (OK / BUSY / ERROR / OFFLINE) based on heartbeat status.

- **Decisions / Signals / Costs tabs**
  - Derived views showing mock decisions awaiting review, agent signals, and cost summaries per agent.
  - Structured to be backed by real data later.

- **Performance tab**
  - Per-agent performance metrics, including:
    - CPU and memory usage.
    - Tasks per minute.
    - Error rate per hour.

- **Architecture tab**
  - Live snapshot of your agent ecosystem, tying to the OpenClaw architecture docs.
  - Per-type counts and health:
    - Total agents.
    - CrewAI / LangGraph / BeeAI / OpenClaw nodes / Admin clients.
    - Online vs offline counts with colored dots.
  - Connection lifecycle text flow:
    - `Client → Gateway → OpenClaw agents / nodes → Admin / Dashboard`.
  - Per-type last activity based on the most recent heartbeat.

- **Alerts and health strip**
  - Top alert strip showing:
    - Number of overdue agents.
    - Number of high-priority (critical) alerts.
  - Clickable to open an Alerts panel in the right column.
  - Alerts panel lists alerts and lets you jump to the related agent.

- **Auto-refresh and status**
  - Configurable polling interval (5 / 15 / 60 seconds).
  - "Last update" timestamp in the top bar.

- **Disclaimer and identity**
  - Footer disclaimer indicating this is an experimental dashboard for Lalit Nayyar with contact info.

---

## How it works (Functionality)

- The **backend** (`backend/app/main.py`) exposes JSON endpoints for:
  - `/agents` – list of agents.
  - `/agents/{id}` – agent detail.
  - `/agents/{id}/tasks` – tasks for a specific agent.
  - `/tasks` – all tasks (mock).
  - `/heartbeats/recent` – recent heartbeats.
  - `/alerts` – alerts (warnings / critical issues).
  - `/metrics/performance` – per-agent performance metrics.
  - `/agents/{id}/commands` – placeholder endpoint for sending commands to agents.

- The **dashboard** (`dashboard/src/App.tsx`):
  - Fetches data from the backend using `VITE_API_BASE_URL` (defaults to `http://localhost:8000` in dev, `/api` in production behind Nginx).
  - Maintains internal state for:
    - Agents, heartbeats, performance metrics, alerts.
    - Selected agent, active center tab.
    - Auto-refresh interval and last update time.
    - Whether the Alerts panel is open.
  - Renders a mission-control UI that updates automatically as data changes.

- Data is currently mocked in the backend for safe development, but the API contracts are designed so you can later plug in real CrewAI, LangGraph, BeeAI, and OpenClaw runtimes.

---

## User Guide

### Local development (Windows)

1. **Clone the repo**

```powershell
cd C:\projects
git clone https://github.com/lalitnayyar/openclaw.git
cd openclaw
```

2. **Set up Python env + backend**

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install fastapi uvicorn[standard]

.venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000
```

3. **Run the dashboard**

```powershell
cd dashboard
npm install
npm run dev
```

4. **Open the UI**

- Open `http://localhost:5173` in your browser.
- The dashboard will connect to `http://localhost:8000` by default.

### Using the dashboard

- **Agents rail (left)**
  - Click an agent card to select it.
  - The center tables and right detail pane will highlight that agent.

- **Center tabs**
  - **Crons** – view heartbeat jobs.
  - **Decisions** – view pending decisions per agent (mock data).
  - **Signals** – recent signals/activity (mock data).
  - **Costs** – daily and month-to-date cost estimates per agent (mock data).
  - **Performance** – CPU/memory/tasks/error-rate per agent.
  - **Architecture** – high-level view tying to the OpenClaw architecture docs.

- **Alerts strip & panel**
  - The strip under the top bar shows alerts summary and is clickable.
  - Clicking opens the Alerts panel on the right where you can:
    - See warning/critical alerts.
    - Click an alert to jump to the related agent.

- **Auto-refresh control**
  - In the top bar, use the **Refresh** dropdown to set polling interval:
    - 5, 15, or 60 seconds.
  - The **Last update** label shows when data was last refreshed.

---

## Administration Guide

### Deploying to an Azure Ubuntu VM (recommended path)

Follow `install-readme.md` for detailed steps. In summary:

1. **Log into the VM**

```bash
ssh -i /path/to/opnclaw-key.pem azureuser@<vm-ip>
```

2. **Clone the repo on the VM**

```bash
cd ~
git clone https://github.com/lalitnayyar/openclaw.git openclaw
cd openclaw
```

3. **Run the installer script**

```bash
cd ~/openclaw
chmod +x scripts/install_on_azure_vm.sh
./scripts/install_on_azure_vm.sh
```

This will:

- Install `python3`, `python3-venv`, `python3-pip`, `nodejs`, `nginx`, and `git`.
- Create a Python virtualenv at `.venv` and install backend dependencies.
- Build the dashboard with `VITE_API_BASE_URL=/api`.
- Create and enable a `systemd` service `openclaw-backend` on port **9000**.
- Configure Nginx to:
  - Serve the dashboard at `http://<vm-ip>/`.
  - Proxy `/api/` to `http://127.0.0.1:9000/`.

4. **Check services**

```bash
sudo systemctl status openclaw-backend
sudo systemctl status nginx
```

If both are active, open `http://<vm-ip>/` in your browser.

### Updating the deployment

When you push changes to GitHub and want to update the VM:

```bash
ssh azureuser@<vm-ip>
cd ~/openclaw
git pull

# Optional: if backend dependencies changed
source .venv/bin/activate
pip install -r <your-backend-reqs-if-added>.txt

# Rebuild dashboard
cd dashboard
export VITE_API_BASE_URL=/api
npm install
npm run build

# Restart services
sudo systemctl restart openclaw-backend
sudo systemctl restart nginx
```

You can also re-run `./scripts/install_on_azure_vm.sh`; it is designed to be safe to re-run for common updates.

### Customization and extensions

- **Real agent integrations**
  - Replace mock data in `backend/app/main.py` with real adapters into CrewAI, LangGraph, BeeAI, and your OpenClaw agents.

- **Authentication & security**
  - Add auth (e.g., OAuth or API keys) at the FastAPI layer and restrict Nginx access as needed.

- **Observability**
  - Add logging and metrics exporters from the backend if you want to integrate with Prometheus, Grafana, etc.

---

## Contact

This dashboard is maintained and operated by **Lalit Nayyar**.

- GitHub: [@lalitnayyar](https://github.com/lalitnayyar)
- Email: `lalitnayyar@gmail.com`
