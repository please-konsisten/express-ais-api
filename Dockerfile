# Use node version 24 as base
FROM node:24-alpine as base

WORKDIR /app
COPY package*.json .
RUN npm install --legacy-peer-deps
RUN chown -R node:node .

USER node

# Development target
FROM base as development

COPY . .
EXPOSE 3000
CMD [ "npm", "run", "dev" ]