#!/usr/bin/env bash
set -euo pipefail

# One-shot installer for OpenClaw dashboard on an Azure Ubuntu VM (no Docker).
# Assumptions:
# - You run this as the non-root user that owns /home/<user>/openclaw (e.g. azureuser).
# - The repo is already cloned to ~/openclaw on the VM.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
APP_USER="$(whoami)"
BACKEND_PORT=9000

cd "${PROJECT_ROOT}"

echo "[1/5] Installing system dependencies (Python, Node, Nginx, Git)..."
sudo apt update
# npm is omitted here because Node.js from NodeSource already includes npm, and the
# Ubuntu npm package conflicts with that Node.js distribution.
sudo apt install -y python3 python3-venv python3-pip nodejs nginx git

echo "[2/5] Setting up Python virtualenv and backend dependencies..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn[standard]

echo "[3/5] Building dashboard frontend with VITE_API_BASE_URL=/api..."
cd "${PROJECT_ROOT}/dashboard"
export VITE_API_BASE_URL="/api"
npm install
npm run build

cd "${PROJECT_ROOT}"

echo "[4/5] Creating systemd service for backend on port ${BACKEND_PORT}..."
SERVICE_FILE="/etc/systemd/system/openclaw-backend.service"

sudo tee "${SERVICE_FILE}" >/dev/null << EOF
[Unit]
Description=OpenClaw Backend (FastAPI)
After=network.target

[Service]
User=${APP_USER}
WorkingDirectory=${PROJECT_ROOT}
Environment="PATH=${PROJECT_ROOT}/.venv/bin"
ExecStart=${PROJECT_ROOT}/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-backend

echo "[5/5] Configuring Nginx to serve dashboard and proxy /api to backend..."
NGINX_SITE="/etc/nginx/sites-available/openclaw-dashboard"

sudo tee "${NGINX_SITE}" >/dev/null << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    root ${PROJECT_ROOT}/dashboard/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/openclaw-dashboard
sudo rm -f /etc/nginx/sites-enabled/default || true
sudo nginx -t
sudo systemctl restart nginx

echo "\nInstallation complete."
echo "- Backend: http://<vm-ip>:${BACKEND_PORT} (direct)"
echo "- Dashboard: http://<vm-ip>/ (uses /api -> backend, avoiding port conflicts)"
