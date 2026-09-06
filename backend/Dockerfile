FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# git es requerido en runtime: git-clone.service.ts hace `git clone` real
# contra repos públicos (no es una dependencia de build, sino del propio
# proceso de análisis).
RUN apk add --no-cache git

EXPOSE 3000
CMD ["node", "dist/main.js"]
