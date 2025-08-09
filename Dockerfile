FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package.json
RUN npm install

COPY . .

RUN npm run build
# Serve Application using Nginx Server
FROM nginx:alpine
COPY --from=build /app/dist/verum-frontend/browser /usr/share/nginx/html
EXPOSE 80