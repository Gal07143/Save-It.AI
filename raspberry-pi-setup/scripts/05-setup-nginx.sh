#!/bin/bash
#===============================================================================
# Step 5: Setup Nginx Reverse Proxy
# Configures Nginx to serve static files and proxy API requests
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"
FRONTEND_DIST="$APP_DIR/frontend/dist"
USER=$(whoami)

echo "▶ Installing Nginx..."
sudo apt install -y nginx

echo "▶ Creating Nginx configuration..."

# Create configuration that serves static files directly (production mode)
sudo tee /etc/nginx/sites-available/saveit << EOF
# Save-It.AI Nginx Configuration
# Production mode: Static files + API proxy

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=general_limit:10m rate=30r/s;

# Upstream for backend API
upstream backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Frontend static files (production)
    root $FRONTEND_DIST;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml application/xml+rss;

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }

    # WebSocket endpoint
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Health check endpoint (no rate limiting)
    location /api/v1/health/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Static assets caching (JS, CSS, images, fonts)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # SPA routing - serve index.html for all non-API/asset routes
    location / {
        limit_req zone=general_limit burst=50 nodelay;
        try_files \$uri \$uri/ /index.html;
    }

    # Monitoring (Netdata) - internal access only
    location /monitoring/ {
        proxy_pass http://127.0.0.1:19999/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # Deny access to sensitive files
    location ~* \.(env|log|sql|bak)$ {
        deny all;
    }
}
EOF

echo "▶ Setting permissions on frontend dist..."
sudo chown -R "$USER:$USER" "$FRONTEND_DIST" 2>/dev/null || true
sudo chmod -R 755 "$FRONTEND_DIST" 2>/dev/null || true

echo "▶ Enabling site configuration..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/saveit /etc/nginx/sites-enabled/

echo "▶ Testing Nginx configuration..."
if sudo nginx -t; then
    echo "  Configuration: OK"
else
    echo "⚠ Nginx configuration test failed"
    exit 1
fi

echo "▶ Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Verify Nginx is running
sleep 2
if systemctl is-active --quiet nginx; then
    echo "  Nginx: RUNNING"
else
    echo "⚠ Nginx may need manual verification"
fi

echo ""
echo "✔ Nginx setup complete!"
echo ""
echo "  Configuration: /etc/nginx/sites-available/saveit"
echo "  Static files:  $FRONTEND_DIST"
echo ""
echo "  Access:"
echo "    Web UI:  http://$(hostname).local"
echo "    API:     http://$(hostname).local/api/v1"
echo "    Health:  http://$(hostname).local/api/v1/health/live"
