FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

EXPOSE 8444

CMD ["node", "server.js"]
