# Use Node 20 on Alpine because sqlite3 6.x requires Node >=20.17
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this layer when package files don't change.
# npm ci is currently failing in Docker on this dependency tree, while npm install resolves it correctly.
COPY package*.json ./
RUN npm install

# Copy app sources
COPY . .

# Copy entrypoint helper script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
	&& chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the port the Express app listens on
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
