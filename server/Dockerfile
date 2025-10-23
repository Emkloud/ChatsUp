# Build and run the Node/Express server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=4001
EXPOSE 4001
CMD ["node", "src/index.js"]
