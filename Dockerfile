FROM node:22-alpine AS base
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY package*.json ./

# --- desenvolvimento: instala devDependencies (nodemon) e monta código via volume ---
FROM base AS dev
RUN npm ci
COPY . .
CMD ["npx", "nodemon", "src/app.js"]

# --- produção: sem devDependencies, código copiado na imagem ---
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/dados/docs
EXPOSE 3000
CMD ["node", "src/app.js"]
