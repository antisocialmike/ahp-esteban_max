# Usar Node 20 en Alpine porque sqlite3 6.x requiere Node >=20.17
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para que Docker pueda cachear esta capa cuando no cambien los archivos de paquetes.
# Actualmente npm ci falla en Docker con este árbol de dependencias, mientras que npm install lo resuelve correctamente.
COPY package*.json ./
RUN npm install

# Copiar fuentes de la aplicación
COPY . .

# Copiar script auxiliar de inicio
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
	&& chmod +x /usr/local/bin/docker-entrypoint.sh

# Exponer el puerto donde escucha la app de Express
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
