# Script para instalar y configurar Jenkins en Windows
# Ejecución: powershell -ExecutionPolicy Bypass -File install-jenkins.ps1

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Instalacion de Jenkins" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si Docker está instalado
Write-Host "Verificando Docker..." -ForegroundColor Yellow

$dockerCheck = docker --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker no esta instalado" -ForegroundColor Red
    Write-Host "   Descargalo en: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker encontrado: $dockerCheck" -ForegroundColor Green
Write-Host ""

# Crear volumen de Jenkins
Write-Host "Creando volumen de Jenkins..." -ForegroundColor Yellow
docker volume create jenkins_home 2>$null

# Ejecutar Jenkins
Write-Host "Iniciando contenedor Jenkins..." -ForegroundColor Yellow
docker run -d `
  --name jenkins `
  -p 8080:8080 `
  -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -e JENKINS_OPTS="--httpPort=8080" `
  -e JAVA_OPTS="-Xmx2g -Xms1g" `
  jenkins/jenkins:lts-jdk17-alpine 2>$null

# Esperar a que Jenkins inicie
Write-Host "Esperando que Jenkins inicie (puede tomar 30-60 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Obtener la contraseña inicial
Write-Host "Obteniendo contraseña inicial..." -ForegroundColor Yellow
$password = ""
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    try {
        $password = docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>$null
        if ($password) {
            break
        }
    }
    catch {
        # Ignorar error
    }
    $attempt++
    Start-Sleep -Seconds 2
}

# Mostrar información
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Jenkins instalado exitosamente!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Acceso a Jenkins:" -ForegroundColor White
Write-Host "   http://localhost:8080" -ForegroundColor Cyan
Write-Host ""

if ($password) {
    Write-Host "Contraseña inicial:" -ForegroundColor White
    Write-Host "   $password" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Proximos pasos:" -ForegroundColor White
Write-Host "  1. Abre http://localhost:8080 en tu navegador" -ForegroundColor Gray
Write-Host "  2. Ingresa la contraseña inicial" -ForegroundColor Gray
Write-Host "  3. Instala los plugins recomendados:" -ForegroundColor Gray
Write-Host "     - Pipeline" -ForegroundColor Gray
Write-Host "     - GitHub Integration" -ForegroundColor Gray
Write-Host "     - Node.js Plugin" -ForegroundColor Gray
Write-Host "     - Docker Pipeline" -ForegroundColor Gray
Write-Host "  4. Lee JENKINS_SETUP.md para configurar el pipeline" -ForegroundColor Gray
Write-Host ""

Write-Host "Comandos utiles:" -ForegroundColor White
Write-Host "  Ver logs:" -ForegroundColor Gray
Write-Host "    docker logs jenkins -f" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Detener Jenkins:" -ForegroundColor Gray
Write-Host "    docker stop jenkins" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Reiniciar Jenkins:" -ForegroundColor Gray
Write-Host "    docker restart jenkins" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Eliminar Jenkins:" -ForegroundColor Gray
Write-Host "    docker stop jenkins" -ForegroundColor Cyan
Write-Host "    docker rm jenkins" -ForegroundColor Cyan
Write-Host "    docker volume rm jenkins_home" -ForegroundColor Cyan
Write-Host ""
