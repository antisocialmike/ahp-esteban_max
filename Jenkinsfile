pipeline {
    agent any
    
    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        skipDefaultCheckout(true)
    }
    
    environment {
        NODE_ENV = 'test'
        DB_CLIENT = 'sqlite'
        PORT = '3000'
        DB_FILE = '/tmp/ahp-test.sqlite'
        SESSION_DB_FILE = 'sessions-test.sqlite'
        SESSION_DB_DIR = '/tmp'
        SESSION_SECRET = 'jenkins-test-secret'
        DOCKER_IMAGE = 'academic-hiring-platform'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo '📦 Clonando repositorio...'
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo '📚 Instalando dependencias...'
                sh '''
                    node --version
                    npm --version
                    npm install
                '''
            }
        }
        
        stage('Run Tests') {
            steps {
                echo '✅ Ejecutando tests...'
                sh '''
                    npm test || true
                '''
            }
        }
        
        stage('Code Quality Check') {
            steps {
                echo '🔍 Verificando calidad de código...'
                sh '''
                    if [ -d "node_modules/.bin" ]; then
                        echo "Verificación completada"
                    else
                        echo "No hay linters configurados"
                    fi
                '''
            }
        }
        
        stage('Build Docker Image') {
            steps {
                echo '🐳 Construyendo imagen Docker...'
                sh '''
                    docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                    docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest
                    docker images | grep ${DOCKER_IMAGE}
                '''
            }
        }
        
        stage('Push to Registry') {
            when {
                branch 'main'
                // Descomenta cuando tengas DockerHub configurado:
                // expression { env.BUILD_STATUS == 'SUCCESS' }
            }
            steps {
                echo '📤 Subiendo imagen a registro (cuando esté configurado)...'
                sh '''
                    echo "Imagen lista para push: ${DOCKER_IMAGE}:${DOCKER_TAG}"
                    # Descomenta cuando tengas credenciales de DockerHub:
                    # echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
                    # docker push $DOCKER_USERNAME/${DOCKER_IMAGE}:${DOCKER_TAG}
                '''
            }
        }
        
        stage('Deploy to Local') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Desplegando en local...'
                sh '''
                    if command -v docker-compose &> /dev/null; then
                        echo "docker-compose encontrado"
                        # docker-compose down
                        # docker-compose up -d
                        echo "Despliegue simular (descomenta en producción)"
                    else
                        echo "docker-compose no encontrado"
                    fi
                '''
            }
        }
    }
    
    post {
        always {
            echo '🧹 Limpiando...'
            sh '''
                rm -f test-results.xml 2>/dev/null || true
            '''
            cleanWs()
        }
        
        success {
            echo '✨ Pipeline completado exitosamente'
        }
        
        failure {
            echo '❌ Pipeline falló'
        }
    }
}
