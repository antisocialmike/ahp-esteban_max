# Use Node 18 on Alpine for a small production image
FROM node:18-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this layer when package files don't change
COPY package*.json ./
RUN npm ci

# Copy app sources
COPY . .

# Copy entrypoint helper script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
	&& chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the port the Express app listens on
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
