# Stage 1: Install dependencies
FROM node:20.10.0-slim as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Copy application files
COPY . .

# Expose port
EXPOSE 4000

# Command to run the server
CMD ["node", "server.js"]