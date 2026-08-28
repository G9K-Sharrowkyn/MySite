# Dockerfile (for frontend in project root)
FROM node:24

WORKDIR /usr/src/app

COPY package*.json ./
COPY SR/package*.json ./SR/
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
