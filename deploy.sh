#!/bin/bash

# Deployment script for slideshow.coded.gdn (Frameflow)
# Run from your LOCAL machine — builds, uploads, and restarts under PM2.

set -e

SSH_KEY=~/.ssh/id_ed25519
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
SSH_USER=coded-slideshow
SSH_HOST=85.190.246.11
REMOTE_DIR=/home/coded-slideshow/htdocs/slideshow.coded.gdn
APP_PORT=3070

echo "=== Building Vite App ==="
rm -rf dist
npm run build

echo ""
echo "=== Uploading to Server ==="
ssh $SSH_OPTS $SSH_USER@$SSH_HOST "mkdir -p $REMOTE_DIR"

# Built app, static server, PM2 config, and package.json (for server deps).
scp $SSH_OPTS -r dist/* $SSH_USER@$SSH_HOST:$REMOTE_DIR/
scp $SSH_OPTS server.js ecosystem.config.cjs package.json $SSH_USER@$SSH_HOST:$REMOTE_DIR/

echo ""
echo "=== Deploying on Server ==="
ssh $SSH_OPTS $SSH_USER@$SSH_HOST 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd '$REMOTE_DIR' && echo "Installing server deps..." && npm install --omit=dev --no-audit --no-fund 2>/dev/null || true && echo "Installing PM2..." && npm install -g pm2 2>/dev/null || true && echo "Starting app..." && pm2 restart ecosystem.config.cjs --env production 2>/dev/null || pm2 start ecosystem.config.cjs --env production && pm2 save && echo "=== DEPLOYMENT COMPLETE ===" && pm2 status'

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "App:     http://$SSH_HOST:$APP_PORT"
echo "Domain:  https://slideshow.coded.gdn"
echo ""
echo "Useful commands:"
echo "  ssh -i $SSH_KEY $SSH_USER@$SSH_HOST"
echo "  pm2 logs slideshow        # View logs"
echo "  pm2 status                # Check status"
echo "  pm2 restart slideshow     # Restart app"
