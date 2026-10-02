# Online game server (also serves the web version of the game).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY client ./client
COPY server ./server
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.js"]
