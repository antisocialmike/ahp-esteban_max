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
                // Sin "|| true", si el test falla, el pipeline se detiene aquí.
                sh 'npm test'
            }
        }
        
        stage('Code Quality Check') {
            steps {
                echo '🔍 Verificando calidad de código con ESLint...'
                // Ejecución directa: si hay errores, el pipeline truena aquí.
                sh './node_modules/.bin/eslint .'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                echo '🐳 Construyendo imagen Docker...'
                sh '''
                    docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                    docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest
                '''
            }
        }
        
        stage('Push to Registry') {
            when {
                anyOf {
                    branch 'main'
                    branch 'feat/rama_Esteban_Max'
                }
            }
            steps {
                echo "📤 Imagen lista para registro: ${DOCKER_IMAGE}:${DOCKER_TAG}"
            }
        }
        
        stage('Deploy to Local') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Desplegando en local...'
                sh '''
                    export DEPLOY_CONTAINER=academic-hiring-platform-app
                    docker rm -f $DEPLOY_CONTAINER 2>/dev/null || true
                    docker run -d --name $DEPLOY_CONTAINER -p 3000:3000 ${DOCKER_IMAGE}:latest
                '''
            }
            post {
                success {
                    echo '✅ Deploy exitoso, guardando imagen estable...'
                    sh 'docker tag ${DOCKER_IMAGE}:latest ${DOCKER_IMAGE}:stable'
                }
                failure {
                    echo '⚠️ Deploy fallido, ejecutando rollback a la última versión estable...'
                    sh '''
                        export DEPLOY_CONTAINER=academic-hiring-platform-app
                        if docker image inspect ${DOCKER_IMAGE}:stable > /dev/null 2>&1; then
                            docker rm -f $DEPLOY_CONTAINER 2>/dev/null || true
                            docker run -d --name $DEPLOY_CONTAINER -p 3000:3000 ${DOCKER_IMAGE}:stable
                            echo "Rollback completado con éxito."
                        else
                            echo "ERROR: No se encontró imagen estable para realizar rollback."
                            exit 1
                        fi
                    '''
                }
            }
        }
    }
    
    post {
        always {
            echo '🧹 Limpiando espacio de trabajo...'
            cleanWs()
        }
        
        success {
            echo '✨ Pipeline completado exitosamente. ¡Código de calidad!'
        }
        
        failure {
            echo '❌ El pipeline falló. Revisa los logs de ESLint o de los Tests.'
        }
    }
}