FROM node:22-bookworm-slim AS build

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

FROM nginx:1.27-alpine AS web

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80
