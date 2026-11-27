# syntax=docker/dockerfile:1
# Build one image with: docker build --target api|ui -t petfinder-<target> .

FROM node:22-alpine AS base
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true NX_SKIP_NX_CACHE=true
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build-api
COPY . .
RUN npx nx run api:prune --skip-nx-cache

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-api /workspace/dist/apps/api ./
RUN npm ci --omit=dev --no-audit --no-fund && rm -rf /root/.npm
# RDS certificates chain to Amazon's roots, which Node doesn't trust by default (used via DB_SSL_CA).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
USER node
EXPOSE 3000
CMD ["node", "main.js"]

FROM base AS build-ui
COPY . .
RUN npx nx build ui --skip-nx-cache

FROM nginxinc/nginx-unprivileged:alpine AS ui
COPY apps/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-ui /workspace/dist/apps/ui/browser /usr/share/nginx/html
EXPOSE 8080
