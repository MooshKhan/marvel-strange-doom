# -----------------------------
# Stage 1: Build React frontend
# -----------------------------
    FROM node:24-bookworm-slim AS client-build

    WORKDIR /app
    
    COPY client/package.json client/package-lock.json ./client/
    
    RUN npm ci --prefix client
    
    COPY client ./client
    
    RUN npm run build --prefix client
    
    
    # -----------------------------
    # Stage 2: Build Node backend
    # -----------------------------
    FROM node:24-bookworm-slim AS server-build
    
    WORKDIR /app
    
    COPY server/package.json server/package-lock.json ./server/
    
    RUN npm ci --prefix server --include=dev
    
    COPY server ./server
    
    RUN npm run build --prefix server
    
    # Remove packages needed only while developing/building.
    RUN npm prune --prefix server --omit=dev
    
    
    # -----------------------------
    # Stage 3: Production image
    # -----------------------------
    FROM node:24-bookworm-slim AS runtime
    
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=3001
    
    COPY --from=server-build /app/server/package.json ./server/package.json
    COPY --from=server-build /app/server/package-lock.json ./server/package-lock.json
    COPY --from=server-build /app/server/node_modules ./server/node_modules
    COPY --from=server-build /app/server/dist ./server/dist
    
    COPY --from=client-build /app/client/dist ./client/dist
    
    EXPOSE 3001
    
    HEALTHCHECK \
      --interval=30s \
      --timeout=5s \
      --start-period=10s \
      --retries=3 \
      CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
    
    CMD ["node", "server/dist/index.js"]