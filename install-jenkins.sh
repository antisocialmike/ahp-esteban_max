#!/bin/bash
# Script para instalar y configurar Jenkins rápidamente

set -e

echo "🚀 Iniciando instalación de Jenkins para Academic Hiring Platform..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    echo "  Descárgalo en: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}✅ Docker encontrado${NC}"

# Crear volumen de Jenkins
echo "📦 Creando volumen de Jenkins..."
docker volume create jenkins_home 2>/dev/null || echo "   Volumen ya existe"

# Ejecutar Jenkins
echo "🐳 Iniciando contenedor Jenkins..."
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e JENKINS_OPTS="--httpPort=8080" \
  -e JAVA_OPTS="-Xmx2g -Xms1g" \
  jenkins/jenkins:lts-jdk17-alpine 2>/dev/null || echo "   Contenedor ya existe"

# Esperar a que Jenkins inicie
echo "⏳ Esperando que Jenkins inicie (puede tomar 30-60 segundos)..."
sleep 10

# Intentar obtener la contraseña inicial
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker logs jenkins 2>/dev/null | grep -q "Jenkins initial setup is required"; then
        sleep 5
        PASSWORD=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || echo "")
        if [ ! -z "$PASSWORD" ]; then
            break
        fi
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
done

# Mostrar información
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ ¡Jenkins instalado exitosamente!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "📍 Acceso a Jenkins: ${YELLOW}http://localhost:8080${NC}"
echo ""

if [ ! -z "$PASSWORD" ]; then
    echo "🔑 Contraseña inicial:"
    echo -e "   ${YELLOW}$PASSWORD${NC}"
    echo ""
fi

echo "📋 Próximos pasos:"
echo "  1. Abre http://localhost:8080 en tu navegador"
echo "  2. Ingresa la contraseña inicial"
echo "  3. Instala los plugins recomendados"
echo "  4. Lee JENKINS_SETUP.md para configurar el pipeline"
echo ""
echo "🐳 Ver logs:"
echo "  docker logs jenkins -f"
echo ""
echo "🛑 Detener Jenkins:"
echo "  docker stop jenkins"
echo ""
echo "🔄 Reiniciar Jenkins:"
echo "  docker restart jenkins"
echo ""
