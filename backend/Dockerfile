# Node 24 alpine
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build \
    && npm prune --omit=dev \
    && npm install prisma@7.8.0 --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./prisma.config.ts
RUN mkdir -p logs && chown nodejs:nodejs logs
USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
