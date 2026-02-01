#!/bin/bash
#===============================================================================
# Step 6: Setup Systemd Services
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"
USER=$(whoami)

echo "▶ Creating backend service..."
sudo tee /etc/systemd/system/saveit-backend.service << EOF
[Unit]
Description=Save-It.AI Backend API
After=network.target postgresql.service redis.service mosquitto.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin:/usr/bin:/bin
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Creating frontend service..."
sudo tee /etc/systemd/system/saveit-frontend.service << EOF
[Unit]
Description=Save-It.AI Frontend
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR/frontend
ExecStart=/usr/bin/serve -s dist -l 5002
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Creating webhook deploy service..."
# First create the webhook handler
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
                subprocess.Popen([DEPLOY_SCRIPT])
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Deployment started')
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(f'Ignored push to {ref}'.encode())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        print(f"[Webhook] {args[0]}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 9000), WebhookHandler)
    print("Webhook server running on port 9000...")
    server.serve_forever()
PYTHON
chmod +x "$APP_DIR/scripts/webhook-handler.py"

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "$WEBHOOK_SECRET" > "$HOME/.saveit/webhook-secret"
chmod 600 "$HOME/.saveit/webhook-secret"

sudo tee /etc/systemd/system/saveit-webhook.service << EOF
[Unit]
Description=Save-It.AI Webhook Deploy Handler
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
Environment=WEBHOOK_SECRET=$WEBHOOK_SECRET
ExecStart=/usr/bin/python3 $APP_DIR/scripts/webhook-handler.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "▶ Reloading systemd..."
sudo systemctl daemon-reload

echo "▶ Enabling services..."
sudo systemctl enable saveit-backend saveit-frontend saveit-webhook

echo "▶ Starting services..."
sudo systemctl start saveit-backend saveit-frontend saveit-webhook

echo "▶ Checking service status..."
sleep 3
sudo systemctl status saveit-backend --no-pager || true
sudo systemctl status saveit-frontend --no-pager || true

echo ""
echo "✔ Services setup complete!"
echo ""
echo "Webhook secret saved to: ~/.saveit/webhook-secret"
echo "Add this secret to your GitHub repository webhook settings."
