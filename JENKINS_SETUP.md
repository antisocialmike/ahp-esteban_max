# Guía de Configuración de Jenkins - Academic Hiring Platform

## Archivos Creados

✅ `Jenkinsfile` - Pipeline de CI/CD automático

## Pasos para Configurar Jenkins

### 1. Instalación (elige una opción)

**Opción A: Docker (Recomendado)**
```powershell
docker volume create jenkins_home
docker run -d `
  -p 8080:8080 `
  -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v /var/run/docker.sock:/var/run/docker.sock `
  --name jenkins `
  jenkins/jenkins:lts
```

**Opción B: Windows (descargable)**
- Ve a https://jenkins.io/download
- Descarga `jenkins.msi`
- Ejecuta el instalador

### 2. Acceso Inicial

1. Abre `http://localhost:8080`
2. Obtén la contraseña:
   ```powershell
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. Instala los plugins recomendados

### 3. Instalar Plugins Necesarios

En Jenkins, ve a **Manage Jenkins** → **Manage Plugins** → **Available**:

- ✅ Pipeline
- ✅ GitHub Integration
- ✅ Node.js Plugin
- ✅ Docker Pipeline
- ✅ Credentials Binding
- ✅ Blue Ocean (opcional, para UI mejorada)

### 4. Crear el Job en Jenkins

1. **New Item**
2. Nombre: `academic-hiring-platform-pipeline`
3. Tipo: **Pipeline**
4. En sección **Pipeline**:
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: Tu URL de GitHub
     ```
     https://github.com/AL07149571/academic-hiring-platform-AHP-.git
     ```
   - Branch Specifier: `*/main`
   - Script Path: `Jenkinsfile` (la ruta por defecto)
5. Habilitar **Poll SCM** u usa webhook de GitHub

### 5. Configurar Webhook de GitHub (Automático)

1. Ve a tu repositorio GitHub
2. **Settings** → **Webhooks** → **Add webhook**
3. Payload URL:
   ```
   http://TU_IP:8080/github-webhook/
   ```
4. Content type: `application/json`
5. Events: `Push events` y `Pull requests`
6. Active: ✅

### 6. Configurar Credenciales (Opcional)

Para DockerHub/AWS later:

1. **Manage Jenkins** → **Manage Credentials**
2. **Global** → **Add Credentials**

**GitHub:**
- Type: Username with password
- Username: tu_usuario_github
- Password: tu_token (genérate en Settings > Developer settings)

**DockerHub:**
- Type: Username with password  
- Username: tu_usuario_docker
- Password: tu_token_docker

### 7. Variables del Jenkinsfile

El Jenkinsfile define automáticamente:
- `NODE_ENV=test`
- `DB_CLIENT=sqlite`
- `PORT=3000`
- Otros según necesidad

Puedes modificarlos dentro del bloque `environment {}`.

### 8. Ejecutar el Pipeline

1. Abre tu job: `academic-hiring-platform-pipeline`
2. Click **Build Now**
3. Mira el progreso en **Console Output**

### 9. Resultado Esperado

El pipeline realizará estos pasos automáticamente:

```
✅ Checkout       → Clona tu código
✅ Install        → npm install
✅ Tests          → npm test
✅ Quality Check  → Verifica código
✅ Build Docker   → docker build
✅ Push Registry  → (opcional)
✅ Deploy         → (solo en rama main)
```

## Comandos Útiles

```powershell
# Ver logs de Jenkins
docker logs jenkins -f

# Reiniciar Jenkins
docker restart jenkins

# Ver imagen Docker creada
docker images | findstr academic-hiring-platform

# Ejecutar contenedor desde imagen creada
docker run -d -p 3001:3000 academic-hiring-platform:latest
```

## Troubleshooting

### Jenkins no ve GitHub
- Verifica que tengas git instalado
- Entra en **Manage Jenkins** → **System** → git path

### Falla en npm install
- El Dockerfile tiene Node 20-alpine
- Jenkins necesita Node 20+ instalado localmente

### Docker build falla
- Jenkins necesita acceso a Docker socket
- En Windows, asegúrate que Docker Desktop esté corriendo

### Webhook no dispara
- Verifica firewall: Jenkins en puerto 8080 accesible
- Prueba manualmente: **Build Now**

## Proximos Pasos

1. Añade notificaciones Slack (opcional)
2. Configura DockerHub push (cuando esté listo)
3. Agrega tests con PostgreSQL en etapa separate
4. Implementa artifactos y reportes de cobertura

¡Configura Jenkins y prueba el pipeline! 🚀
