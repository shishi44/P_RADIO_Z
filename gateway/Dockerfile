FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts=false && npm cache clean --force
COPY server.js ./
USER node
CMD ["npm", "start"]
