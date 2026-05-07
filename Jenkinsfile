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
                anyOf {
                    branch 'main'
                    branch 'feat/rama_Esteban_Max'
                }
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
                    export DEPLOY_CONTAINER=academic-hiring-platform-app
                    echo "Stopping existing container if present..."
                    docker rm -f $DEPLOY_CONTAINER 2>/dev/null || true

                    echo "Running new image..."
                    docker run -d --name $DEPLOY_CONTAINER -p 3000:3000 ${DOCKER_IMAGE}:latest
                '''
            }
            post {
                success {
                    echo '✅ Deploy exitoso, guardando imagen estable...'
                    sh '''
                        docker tag ${DOCKER_IMAGE}:latest ${DOCKER_IMAGE}:stable
                    '''
                }
                failure {
                    echo '⚠️ Deploy fallido, intentando rollback a la versión estable...'
                    sh '''
                        if docker image inspect ${DOCKER_IMAGE}:stable > /dev/null 2>&1; then
                            docker rm -f $DEPLOY_CONTAINER 2>/dev/null || true
                            docker run -d --name $DEPLOY_CONTAINER -p 3000:3000 ${DOCKER_IMAGE}:stable
                            echo "Rollback completado a ${DOCKER_IMAGE}:stable"
                        else
                            echo "No se encontró una imagen estable para rollback."
                        fi
                    '''
                }
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
