# SAVE-IT.AI Frontend Dockerfile
# Multi-stage build with nginx for production serving

# =============================================================================
# Stage 1: Build - Compile TypeScript and build production bundle
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --silent

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# =============================================================================
# Stage 2: Production - nginx serving static files
# =============================================================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add security headers configuration
RUN echo 'add_header X-Frame-Options "DENY" always;' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;' >> /etc/nginx/conf.d/security-headers.conf

# Create non-root user
RUN addgroup -g 1001 -S saveit && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G saveit -g saveit saveit && \
    chown -R saveit:saveit /var/cache/nginx && \
    chown -R saveit:saveit /var/log/nginx && \
    chown -R saveit:saveit /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R saveit:saveit /var/run/nginx.pid && \
    chown -R saveit:saveit /usr/share/nginx/html

# Switch to non-root user
USER saveit

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
