ARG NODE_VERSION=26
FROM node:${NODE_VERSION}-slim AS base

# slim berbasis Debian: openssl dipasang lewat apt (dibutuhkan Prisma)
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node

# .npmrc ikut disalin supaya opsi seperti legacy-peer-deps=true terbaca saat npm ci
COPY --chown=node:node package*.json .npmrc* ./
RUN npm ci --legacy-peer-deps 


FROM base AS development

# COPY --chown=node:node prisma ./prisma/
# RUN npx prisma generate

COPY --chown=node:node . .

EXPOSE 3000
CMD ["npm", "run", "dev"]