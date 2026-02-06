#!/bin/bash
#===============================================================================
# Step 6: Setup Systemd Services
# Creates and enables systemd services for Save-It.AI backend
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"
USER=$(whoami)
GROUP=$(id -gn)

echo "▶ Creating backend service..."
sudo tee /etc/systemd/system/saveit-backend.service << EOF
[Unit]
Description=Save-It.AI Backend API
After=network.target postgresql.service redis-server.service mosquitto.service
Requires=postgresql.service
Wants=redis-server.service mosquitto.service

[Service]
Type=simple
User=$USER
Group=$GROUP
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin:/usr/bin:/bin"
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR/backend/logs

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Creating webhook deploy service..."

# Create webhook handler script
mkdir -p "$APP_DIR/scripts"
cat > "$APP_DIR/scripts/webhook-handler.py" << 'PYTHON'
#!/usr/bin/env python3
"""GitHub Webhook Handler for Auto-Deployment"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import hmac
import hashlib
import os
import json
import logging

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s')
logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'change-me-to-secure-secret')
DEPLOY_SCRIPT = os.path.expanduser('~/Save-It.AI/dev-reload.sh')

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/deploy':
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)

        # Verify signature
        signature = self.headers.get('X-Hub-Signature-256', '')
        expected = 'sha256=' + hmac.new(
            WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            logger.warning("Invalid webhook signature")
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'Invalid signature')
            return

        # Parse payload
        try:
            data = json.loads(payload)
            ref = data.get('ref', '')

            # Only deploy on push to main branch
            if ref == 'refs/heads/main':
                logger.info("Deploying from main branch...")
                subprocess.Popen([DEPLOY_SCRIPT])
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Deployment started')
            else:
                logger.info(f"Ignored push to {ref}")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(f'Ignored push to {ref}'.encode())
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        logger.info(f"{args[0]} {args[1]} {args[2]}")

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 9000), WebhookHandler)
    logger.info("Webhook server running on port 9000...")
    server.serve_forever()
PYTHON
chmod +x "$APP_DIR/scripts/webhook-handler.py"

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
mkdir -p "$HOME/.saveit"
echo "$WEBHOOK_SECRET" > "$HOME/.saveit/webhook-secret"
chmod 600 "$HOME/.saveit/webhook-secret"

sudo tee /etc/systemd/system/saveit-webhook.service << EOF
[Unit]
Description=Save-It.AI Webhook Deploy Handler
After=network.target

[Service]
Type=simple
User=$USER
Group=$GROUP
Environment=WEBHOOK_SECRET=$WEBHOOK_SECRET
ExecStart=/usr/bin/python3 $APP_DIR/scripts/webhook-handler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Reloading systemd..."
sudo systemctl daemon-reload

echo "▶ Enabling services..."
sudo systemctl enable saveit-backend
sudo systemctl enable saveit-webhook

echo "▶ Starting services..."
sudo systemctl start saveit-backend
sudo systemctl start saveit-webhook

echo "▶ Checking service status..."
sleep 5

# Check backend
if systemctl is-active --quiet saveit-backend; then
    echo "  saveit-backend: RUNNING"

    # Test API health
    sleep 2
    if curl -sf http://localhost:8000/api/v1/health/live > /dev/null 2>&1; then
        echo "  API health:     OK"
    else
        echo "  API health:     Waiting for startup..."
    fi
else
    echo "  saveit-backend: FAILED"
    echo ""
    echo "  Checking logs:"
    sudo journalctl -u saveit-backend -n 20 --no-pager
fi

# Check webhook
if systemctl is-active --quiet saveit-webhook; then
    echo "  saveit-webhook: RUNNING"
else
    echo "  saveit-webhook: Not running (optional)"
fi

echo ""
echo "✔ Services setup complete!"
echo ""
echo "  Backend service: saveit-backend"
echo "  Webhook service: saveit-webhook (optional)"
echo ""
echo "  Commands:"
echo "    View logs:     sudo journalctl -u saveit-backend -f"
echo "    Restart:       sudo systemctl restart saveit-backend"
echo "    Stop:          sudo systemctl stop saveit-backend"
echo ""
echo "  Webhook secret saved to: ~/.saveit/webhook-secret"
echo "  Add this to GitHub repository webhook settings for auto-deploy."
