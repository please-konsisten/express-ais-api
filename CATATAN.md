# Proses Setup Rest API menggunakan Docker + Node JS + Redis untuk Academic Information System (AIS)
### 1. Input command bash dibawah:
```bash
git init && docker init
```
### 2. Setup Dockerfile:
```dockerfile
# Use node version 24 as base
FROM node:24-alpine as base

WORKDIR /app
COPY package*.json .
RUN npm install --legacy-peer-deps

# Development target
FROM base as development

COPY . .
EXPOSE 5000
CMD [ "npm", "run", "dev" ]
```
### 3. Setup file ```compose.yaml```:
```dockerfile
services:
  app:
    build:
      context: .
      target: development
    container_name: ais-api-dev
    ports:
      - "5000:5000"
    volumes:
      - .:/app
      - /app/node_modules 
    environment:
      NODE_ENV: development
      PORT: 5000
      DATABASE_URL: postgresql://postgres:secretpassword@ais-db-dev:5432/mydb?schema=public
      REDIS_URL: redis://ais-redis-dev:6379 
    depends_on:
      - postgres-db
      - redis
    
  postgres-db:
    image: postgres:15-alpine
    container_name: ais-db-dev
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secretpassword
      POSTGRES_DB: mydb
    volumes:
      - ais_db_data:/var/lib/postgresql/data

  adminer:
    image: adminer
    container_name: ais-adminer-dev
    restart: always
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: postgres-db
    depends_on:
      - postgres-db

  redis:
    container_name: ais-redis-dev
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  ais_db_data:
    name: ais-db-data
```
**Catatan Penting:**
> Selalu perhatikan penamaan setiap container.

### 4. Jalankan command:
```bash
docker container run --rm -it --name temp_node --user "$(id -u):$(id -g)" --volume "$(pwd):/app" node:24-alpine sh
```
**Catatan Penting:**

Pastikan telah change directory ke ```/app``` dengan command: 
```bash
cd /app
```

### 5. Install depedensi yang diperlukan:
Masukan command:
```npm
npm init -y
```
Ubah konfigurasi ```./package.json```, menjadi:

```json
  "type": "module",
```

Kemudian install:
```npm
npm install bcrypt express ioredis joi uuid winston
```
Untuk dev depedensi, masukan command:
```
npm install --save-dev @types/bcrypt @types/express @types/supertest @types/uuid supertest
```
### 6. Setup Jest menggunakan Babel
Installasi jest dengan npm:
```npm
npm install --save-dev @types/jest babel-jest jest
```
Lalu baca dokumentasi pada website [https://babeljs.io/setup](https://babeljs.io/setup), dan pilih bagian Jest.

### 7. Installasi Prisma v7
Instalasi Typescript:
```npm
npm install typescript tsx @types/node --save-dev
npx tsc --init
```
Instalasi Prisma v7:
```npm
npm install prisma@prev @types/pg --save-dev
npm install @prisma/client@7 @prisma/adapter-pg pg dotenv
```

Baca lebih lanjut pada link: 
[https://www.prisma.io/docs/v7/prisma-orm/quickstart/prisma-postgres?utm_source=docs](https://www.prisma.io/docs/v7/prisma-orm/quickstart/prisma-postgres?utm_source=docs)