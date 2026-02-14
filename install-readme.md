# OpenClaw Agents Dashboard – Azure VM Install (No Docker)

This guide installs the OpenClaw Agents Dashboard (FastAPI backend + React frontend) directly on an **Azure Ubuntu** VM without Docker, and is designed to avoid port conflicts with other OpenClaw services.

## Overview

- Backend: FastAPI (uvicorn) running on **port 9000** (internal only).
- Frontend: built React app served by **Nginx on port 80**.
- API access from the frontend goes through **`/api`** (Nginx reverse proxy to `127.0.0.1:9000`).
- Single installer script: `scripts/install_on_azure_vm.sh`.

## Prerequisites

- Azure Ubuntu VM (e.g. 24.04 LTS).
- SSH access as a normal user (e.g. `azureuser`).
- This repo cloned to the VM, e.g.:

```bash
cd ~
git clone https://github.com/lalitnayyar/openclaw.git openclaw
cd openclaw
```

## One-shot installation

From inside the `openclaw` directory on the VM:

```bash
cd ~/openclaw
chmod +x scripts/install_on_azure_vm.sh
./scripts/install_on_azure_vm.sh
```

The script will:

- Install system dependencies: `python3`, `python3-venv`, `python3-pip`, `nodejs`, `nginx`, `git`.
- Create a Python virtualenv at `.venv` and install `fastapi` and `uvicorn[standard]`.
- Build the dashboard with `VITE_API_BASE_URL=/api` so the frontend calls the backend via Nginx.
- Create and enable a `systemd` service `openclaw-backend` listening on **port 9000**.
- Configure Nginx to:
  - Serve the built dashboard from `dashboard/dist` at `http://<vm-ip>/`.
  - Proxy `/api/` to `http://127.0.0.1:9000/` (backend), avoiding port conflicts.

## After installation

- Open the dashboard in your browser:

  - `http://<vm-ip>/`

- Optional: hit the backend directly (for debugging):

  - `http://<vm-ip>:9000/health`

To check service status:

```bash
sudo systemctl status openclaw-backend
sudo systemctl status nginx
```

To restart after config/code changes:

```bash
# Backend
sudo systemctl restart openclaw-backend

# Nginx
sudo systemctl restart nginx
```

## Updating the deployment (when code changes)

Whenever you push new code to GitHub and want your Azure VM to run the latest version, you have two options.

### Option A – Simple update (recommended)

This is usually enough when you have changed only Python/TypeScript source code or styles.

```bash
ssh azureuser@<vm-ip>

cd ~/openclaw
git pull

# Rebuild dashboard (frontend)
cd dashboard
export VITE_API_BASE_URL=/api
npm install
npm run build

# Restart services to pick up changes
cd ..
sudo systemctl restart openclaw-backend
sudo systemctl restart nginx
```

### Option B – Full reinstall (safe re-run of installer)

If you have changed install scripts or system dependencies and want to be sure everything is refreshed, you can re-run the installer script after pulling changes:

```bash
ssh azureuser@<vm-ip>

cd ~/openclaw
git pull

chmod +x scripts/install_on_azure_vm.sh
./scripts/install_on_azure_vm.sh
```

The installer is written to be idempotent for common updates: it will reinstall any missing packages, rebuild the dashboard, ensure the `openclaw-backend` service is configured, and reload Nginx.

## Integration notes

- The dashboard uses a configurable `VITE_API_BASE_URL` for API calls. In local dev it defaults to `http://localhost:8000`.
- On the Azure VM, the installer builds with `VITE_API_BASE_URL=/api`, allowing Nginx to route traffic to whatever backend port you choose (default **9000**), avoiding conflicts with other OpenClaw services.
- If you already have another Nginx site on port 80, you may want to merge the `openclaw-dashboard` server block into your existing config instead of enabling it as the default server.
