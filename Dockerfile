ARG NODE_VERSION=26
FROM node:${NODE_VERSION}-alpine as base

RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json .

RUN npm install --legacy-peer-deps


FROM base as development

COPY prisma ./prisma/
RUN chown -R node:node /app
USER node

RUN npx prisma generate

COPY --chown=node:node . .

EXPOSE 3000
CMD [ "npm", "run", "dev" ]