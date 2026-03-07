FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install

COPY . .
RUN npm run build --workspace client

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "server"]
