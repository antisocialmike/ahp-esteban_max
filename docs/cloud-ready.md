# Ejecucion Cloud-Ready

Este proyecto ahora soporta dos modos de ejecucion seleccionados por variables de entorno.

## Modo local

Usa SQLite y almacenamiento local de sesiones.

Valores requeridos:

```env
DB_CLIENT=sqlite
DB_FILE=/app/data/ahp.sqlite
SESSION_DB_FILE=sessions.sqlite
SESSION_DB_DIR=/app/data
```

Inicia con:

```powershell
docker compose up -d --build
```

## Modo local cloud-ready

Usa PostgreSQL y Redis en local manteniendo S3 como opcional.

Se incluye un archivo de ejemplo en `.env.cloud-ready`.

Valores requeridos:

```env
DB_CLIENT=postgres
DATABASE_URL=postgres://ahp:ahp_dev_password@postgres:5432/ahp
REDIS_URL=redis://redis:6379
```

Inicia con:

```powershell
docker compose --env-file .env.cloud-ready --profile cloud-ready up -d --build
```

Validalo con:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/ready | Select-Object -ExpandProperty Content
```

Respuesta esperada con MinIO local habilitado:

```json
{"ok":true,"dbConnected":true,"dbBackend":"postgres","sessionBackend":"redis","storageBackend":"s3"}
```

### Validar la ruta de carga a S3

Ejecuta una solicitud de creacion de candidato con un archivo de imagen:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrf = (Invoke-RestMethod -Uri http://localhost:3000/api/auth/csrf-token -WebSession $session).csrfToken
$cookieObj = $session.Cookies.GetCookies('http://localhost:3000') | Where-Object { $_.Name -eq 'connect.sid' } | Select-Object -First 1
$cookieHeader = "$($cookieObj.Name)=$($cookieObj.Value)"
$email = 's3check_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '@example.com'
curl.exe -s -X POST http://localhost:3000/api/candidatos -H "X-CSRF-Token: $csrf" -H "Cookie: $cookieHeader" -F "nombre=Storage Check" -F "correo=$email" -F "telefono=5551230000" -F "area_especialidad=Tecnologia e Ingenieria" -F "experiencia_anos=3" -F "photo=@logo.png"
```

Despues inspecciona la ruta de foto guardada del candidato:

```powershell
docker compose exec postgres psql -U ahp -d ahp -c "select id, photo_path from candidato order by id desc limit 3;"
```

## Mapeo en AWS

Estas variables estan listas para inyectarse desde definiciones de tareas ECS, Secrets Manager o SSM Parameter Store:

- `DATABASE_URL`
- `DB_SSL`
- `REDIS_URL`
- `SESSION_SECRET`
- `RESEND_API_KEY`
- `N8N_WEBHOOK_URL`
- `S3_BUCKET`
- `AWS_REGION`
- `S3_PUBLIC_BASE_URL`

Mapeo recomendado de servicios AWS:

- `DATABASE_URL`: Amazon RDS para PostgreSQL
- `REDIS_URL`: Amazon ElastiCache para Redis
- `S3_BUCKET`: Amazon S3
- `SESSION_SECRET`, `RESEND_API_KEY`, `N8N_WEBHOOK_URL`: AWS Secrets Manager

## Estado verificado

El stack cloud-ready fue validado localmente con:

- PostgreSQL ejecutandose en Docker
- Redis ejecutandose en Docker
- endpoint de readiness devolviendo `dbBackend=postgres` y `sessionBackend=redis`
- creacion autenticada de vacantes exitosa contra el stack en ejecucion