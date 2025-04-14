#!/bin/bash
set -e

echo "🔧 Installing Docker if not present..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh || { echo "❌ Docker install failed"; exit 1; }
fi

echo "🐳 Ensuring Docker is enabled and user is added to docker group..."
sudo systemctl enable docker || echo "⚠️ Couldn't enable Docker"
sudo usermod -aG docker $USER || echo "⚠️ Couldn't add user to docker group"

echo "🔧 Installing docker-compose plugin if missing..."
if ! docker compose version &> /dev/null; then
  mkdir -p ~/.docker/cli-plugins
  curl -SL https://github.com/docker/compose/releases/download/v2.34.0/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
  chmod +x ~/.docker/cli-plugins/docker-compose
fi

cd /var/www/chat.cursor.style

# 📁 Створити mongo_data, якщо не існує
if [ ! -d "mongo_data" ]; then
  echo "📁 Creating mongo_data directory..."
sudo mkdir -p /var/www/chat.cursor.style/mongo_data

fi

echo "📁 Setting permission..."
sudo chown -R ubuntu:ubuntu mongo_data || echo "⚠️ Failed to chown mongo_data"

echo "🧼 Cleaning previous containers..."
docker compose down || echo "⚠️ No containers to stop"

echo "🧱 Building and starting containers..."
docker compose build --no-cache || { echo "❌ Docker Compose failed"; exit 1; }
docker compose up -d

echo "✅ Docker container launched"
