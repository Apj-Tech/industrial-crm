FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY .env.example .env

EXPOSE 5000

CMD sh -c "npx prisma db push && node prisma/seed.js 2>/dev/null; node src/index.js"
