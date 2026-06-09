FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.js ./
COPY chat.js ./
COPY metric_catalog.md ./
EXPOSE 5000
CMD ["npm", "start"]
