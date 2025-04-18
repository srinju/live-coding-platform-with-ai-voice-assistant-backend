FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Add express to package.json
RUN npm install -g typescript
RUN npm install express @types/express --save
RUN npm install

COPY . .

RUN tsc

EXPOSE 3001

CMD ["node", "dist/server/index.js"] 