FROM node:20-slim

WORKDIR /app

# Копіюємо package.json та lock (якщо є)
COPY package*.json ./

# Встановлюємо тільки production залежності
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Копіюємо лише необхідний код (якщо .dockerignore — то тільки src і потрібні файли)
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
