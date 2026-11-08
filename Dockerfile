FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_EXPORT_API_URL=http://localhost:8000
ARG VITE_BASE_URL=/
ENV GITHUB_PAGES=true
ENV VITE_EXPORT_API_URL=$VITE_EXPORT_API_URL
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV NODE_OPTIONS=--dns-result-order=ipv4first

RUN npm run build
RUN npm install serve@14

EXPOSE 8080

# Static SPA: -s rewrites unknown paths to index.html (same role as nginx try_files).
CMD ["./node_modules/.bin/serve", "dist/client", "-s", "-l", "tcp://0.0.0.0:8080"]
