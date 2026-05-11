from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'AHP_Documentacion_Integracion_Jenkins.docx'

NAVY = '1F2937'
RED = 'D33833'
BLUE = '2563EB'
SOFT_RED = 'FFF5F5'
SOFT_BLUE = 'EFF6FF'
SOFT_GRAY = 'F9FAFB'
YELLOW = 'FEF3C7'
DARK = '0F172A'
WHITE = 'FFFFFF'
TEXT = '374151'
MUTED = '6B7280'
BORDER = 'E5E7EB'


def run_xml(text: str, *, bold: bool = False, size: int = 21, color: str = TEXT, font: str = 'Aptos') -> str:
    properties = [
        f'<w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}"/>',
        f'<w:color w:val="{color}"/>',
        f'<w:sz w:val="{size}"/>'
    ]
    if bold:
        properties.append('<w:b/>')
    return (
        '<w:r>'
        f'<w:rPr>{"".join(properties)}</w:rPr>'
        f'<w:t xml:space="preserve">{escape(text)}</w:t>'
        '</w:r>'
    )


def paragraph_xml(
    text: str,
    *,
    bold: bool = False,
    size: int = 21,
    color: str = TEXT,
    font: str = 'Aptos',
    align: str = 'left',
    after: int = 120,
    before: int = 0,
    shade: str | None = None,
    indent: int = 0
) -> str:
    paragraph_properties = [
        f'<w:jc w:val="{align}"/>',
        f'<w:spacing w:before="{before}" w:after="{after}" w:line="276" w:lineRule="auto"/>'
    ]
    if indent:
        paragraph_properties.append(f'<w:ind w:left="{indent}"/>')
    if shade:
        paragraph_properties.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>')
    return f'<w:p><w:pPr>{"".join(paragraph_properties)}</w:pPr>{run_xml(text, bold=bold, size=size, color=color, font=font)}</w:p>'


def empty_paragraph() -> str:
    return '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>'


def cell_xml(inner: str, width: int, *, fill: str | None = None, align: str = 'center') -> str:
    shading = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    return (
        '<w:tc>'
        f'<w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shading}<w:vAlign w:val="{align}"/></w:tcPr>'
        f'{inner}'
        '</w:tc>'
    )


def table_xml(rows: list[list[str]], widths: list[int]) -> str:
    borders = (
        '<w:tblBorders>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        f'<w:insideH w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        f'<w:insideV w:val="single" w:sz="6" w:space="0" w:color="{BORDER}"/>'
        '</w:tblBorders>'
    )
    grid = ''.join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    row_xml = ''.join(f'<w:tr>{"".join(row)}</w:tr>' for row in rows)
    return (
        '<w:tbl>'
        '<w:tblPr>'
        '<w:tblW w:w="0" w:type="auto"/>'
        '<w:tblLayout w:type="fixed"/>'
        f'{borders}'
        '</w:tblPr>'
        f'<w:tblGrid>{grid}</w:tblGrid>'
        f'{row_xml}'
        '</w:tbl>'
    )


def title_body_cell(title: str, body: str, width: int, fill: str, *, title_color: str = NAVY, body_color: str = TEXT) -> str:
    inner = ''.join([
        paragraph_xml(title, bold=True, size=20, color=title_color, after=40),
        paragraph_xml(body, size=20, color=body_color, after=60)
    ])
    return cell_xml(inner, width, fill=fill)


def plain_cell(text: str, width: int, *, fill: str | None = None, bold: bool = False, color: str = TEXT, font: str = 'Aptos', align: str = 'left') -> str:
    return cell_xml(paragraph_xml(text, bold=bold, size=20, color=color, font=font, align=align, after=60), width, fill=fill)


def build_document_xml() -> str:
    body: list[str] = []

    body.append(paragraph_xml('DOCUMENTACIÓN TÉCNICA', bold=True, size=18, color=RED, after=60))
    body.append(paragraph_xml('Implementación de Jenkins en AHP', bold=True, size=48, color=NAVY, font='Aptos Display', after=40))
    body.append(paragraph_xml('Integración de CI/CD para Academic Hiring Platform con foco en validación, empaquetado y despliegue reproducible', bold=True, size=23, color=BLUE, after=160))

    body.append(table_xml([
        [
            title_body_cell('Proyecto', 'Academic Hiring Platform (AHP)', 4680, SOFT_GRAY, title_color=RED),
            title_body_cell('Fase documentada', 'Integración de Jenkins como pipeline de CI/CD', 4680, SOFT_GRAY, title_color=RED)
        ],
        [
            title_body_cell('Stack principal', 'Jenkins, Docker, Node.js, Git', 4680, SOFT_GRAY, title_color=RED),
            title_body_cell('Estado actual', 'Pipeline funcional con deploy local y rollback básico', 4680, SOFT_GRAY, title_color=RED)
        ]
    ], [4680, 4680]))
    body.append(empty_paragraph())

    body.append(paragraph_xml('1. Resumen general', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('AHP fue trabajado en dos partes: primero como plataforma ATS para reclutamiento académico y luego como iniciativa de automatización con Jenkins. Esta documentación resume muy brevemente qué es AHP, pero pone el foco en la segunda fase: cómo el proyecto pasó de depender de validaciones manuales a ejecutar un flujo reproducible de checkout, instalación, pruebas, construcción de imagen y despliegue local.', size=21, color=TEXT, after=120))
    body.append(table_xml([
        [
            title_body_cell('Automatización', 'El repositorio quedó preparado para ejecutar un pipeline único y auditable por cada build.', 3120, SOFT_RED),
            title_body_cell('Reproducibilidad', 'Jenkins corre en un contenedor propio con Node.js 20, Git y Docker CLI preinstalados.', 3120, SOFT_GRAY),
            title_body_cell('Operación', 'El flujo genera imagen Docker, despliega en main y conserva una etiqueta stable para rollback.', 3120, SOFT_BLUE)
        ]
    ], [3120, 3120, 3120]))
    body.append(empty_paragraph())

    body.append(paragraph_xml('2. Qué es AHP', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('Academic Hiring Platform es una plataforma ATS orientada a publicar vacantes, recibir postulaciones y operar un flujo básico de reclutamiento académico. El proyecto combina páginas públicas para candidatos, autenticación y paneles internos, sobre un backend Node.js/Express. A nivel de arquitectura, la aplicación ya soporta modos de persistencia intercambiables: SQLite o PostgreSQL para datos, SQLite o Redis para sesiones y almacenamiento local o S3 para archivos; esa separación fue clave para integrar el pipeline sin acoplarlo a una sola forma de despliegue.', size=21, color=TEXT, after=120))

    body.append(paragraph_xml('3. Objetivo de la integración Jenkins', bold=True, size=32, color=NAVY, after=80, before=80))
    for item in [
        'Centralizar en un solo flujo las tareas de checkout, instalación de dependencias, pruebas, build Docker y despliegue local.',
        'Reducir la dependencia de ejecuciones manuales en máquinas individuales del equipo.',
        'Normalizar el entorno técnico del pipeline con una imagen Jenkins que ya incluye Git, Docker CLI y Node.js 20.',
        'Dejar preparado el camino para publicación en registro de imágenes y posteriores despliegues cloud-ready.'
    ]:
        body.append(paragraph_xml(f'- {item}', size=21, color=TEXT, indent=360, after=60))

    body.append(paragraph_xml('4. Componentes técnicos integrados', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('La integración se apoya en cuatro piezas técnicas principales. Primero, Dockerfile.jenkins extiende la imagen oficial de Jenkins y le agrega Git, Docker CLI y Node.js 20 para ejecutar exactamente las herramientas que el pipeline necesita. Segundo, docker-compose.jenkins.yml define un servicio Jenkins con puertos 8080 y 50000, volumen persistente jenkins_home y acceso al socket de Docker del host para poder construir imágenes desde dentro del servidor de automatización.', size=21, color=TEXT, after=120))
    body.append(paragraph_xml('Tercero, el Jenkinsfile declara el pipeline y fija opciones operativas relevantes: timestamps, retención de builds, timeout de 30 minutos y variables de entorno para correr el proyecto en modo de prueba con SQLite. Cuarto, el pipeline usa una convención de versionado de imágenes basada en academic-hiring-platform:${BUILD_NUMBER}, además de las etiquetas latest y stable para soportar despliegue y rollback.', size=21, color=TEXT, after=120))

    body.append(paragraph_xml('5. Flujo del pipeline', bold=True, size=32, color=NAVY, after=80, before=80))
    stage_rows = [
        [
            plain_cell('Etapa', 1800, fill=RED, bold=True, color=WHITE, align='center'),
            plain_cell('Implementación en Jenkins', 3300, fill=RED, bold=True, color=WHITE, align='center'),
            plain_cell('Aporte al proyecto', 4260, fill=RED, bold=True, color=WHITE, align='center')
        ],
        [
            plain_cell('Checkout', 1800),
            plain_cell('Usa checkout scm después de skipDefaultCheckout(true).', 3300),
            plain_cell('Garantiza que Jenkins trabaje siempre con el estado actual del repositorio.', 4260)
        ],
        [
            plain_cell('Install Dependencies', 1800),
            plain_cell('Ejecuta node --version, npm --version y npm install.', 3300),
            plain_cell('Estandariza el entorno del build y prepara la app para pruebas y empaquetado.', 4260)
        ],
        [
            plain_cell('Run Tests', 1800),
            plain_cell('Lanza npm test, pero hoy está escrito como npm test || true.', 3300),
            plain_cell('Ejecuta la suite actual sin bloquear todavía el build cuando ocurre un fallo.', 4260)
        ],
        [
            plain_cell('Code Quality Check', 1800),
            plain_cell('Valida la presencia de node_modules/.bin como chequeo básico.', 3300),
            plain_cell('Confirma que el toolchain quedó instalado, aunque aún no reemplaza un lint real.', 4260)
        ],
        [
            plain_cell('Build Docker Image', 1800),
            plain_cell('Construye academic-hiring-platform:${BUILD_NUMBER} y etiqueta latest.', 3300),
            plain_cell('Genera el artefacto desplegable y reutilizable por otros entornos.', 4260)
        ],
        [
            plain_cell('Push to Registry', 1800),
            plain_cell('Queda habilitado para main y feat/rama_Esteban_Max, con comandos de push comentados.', 3300),
            plain_cell('Deja listo el punto de integración con Docker Hub u otro registry cuando existan credenciales.', 4260)
        ],
        [
            plain_cell('Deploy to Local', 1800),
            plain_cell('Solo en main: elimina el contenedor previo, levanta la imagen latest y en éxito la etiqueta como stable.', 3300),
            plain_cell('Automatiza la entrega local y deja una versión estable para rollback si el despliegue falla.', 4260)
        ],
        [
            plain_cell('Post actions', 1800),
            plain_cell('Limpia archivos temporales y ejecuta cleanWs() al finalizar.', 3300),
            plain_cell('Mantiene el workspace de Jenkins ordenado entre ejecuciones.', 4260)
        ]
    ]
    body.append(table_xml(stage_rows, [1800, 3300, 4260]))
    body.append(empty_paragraph())
    body.append(paragraph_xml('Secuencia resumida del Jenkinsfile', bold=True, size=19, color=RED, after=40))
    body.append(table_xml([
        [cell_xml(''.join([
            paragraph_xml('pipeline {', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=0),
            paragraph_xml('  Checkout -> Install Dependencies -> Run Tests', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=0),
            paragraph_xml('  -> Code Quality Check -> Build Docker Image', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=0),
            paragraph_xml('  -> Push to Registry (preparado) -> Deploy to Local', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=0),
            paragraph_xml('  post { cleanWs() }', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=0),
            paragraph_xml('}', size=18, color='E5E7EB', font='Consolas', shade=DARK, after=60)
        ]), 9360, fill=DARK)]
    ], [9360]))
    body.append(empty_paragraph())

    body.append(paragraph_xml('6. Cómo se acopla el pipeline a la arquitectura de AHP', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('El pipeline no sólo ejecuta comandos genéricos; aprovecha decisiones previas de la arquitectura de AHP. En Jenkins, el build fija NODE_ENV=test, DB_CLIENT=sqlite, DB_FILE=/tmp/ahp-test.sqlite y archivos de sesión temporales para aislar la validación del entorno productivo. Esto permite correr pruebas sin depender de una base externa y evita contaminar datos reales.', size=21, color=TEXT, after=120))
    body.append(paragraph_xml('Al mismo tiempo, AHP ya abstrae sesiones y almacenamiento mediante variables de entorno. Eso significa que la misma aplicación empaquetada por Jenkins puede evolucionar más adelante hacia PostgreSQL, Redis y S3 sin reescribir la lógica principal. En otras palabras, Jenkins quedó integrado sobre una base que ya estaba siendo preparada para operar de forma cloud-ready.', size=21, color=TEXT, after=120))
    for item in [
        'Las pruebas automáticas actuales cubren conectividad de base de datos, protección CSRF y carga de páginas y assets públicos.',
        'La imagen generada por Jenkins se despliega localmente como academic-hiring-platform-app en el puerto 3000.',
        'Si el deploy en main falla y existe una imagen stable previa, el pipeline intenta restaurarla automáticamente como rollback básico.'
    ]:
        body.append(paragraph_xml(f'- {item}', size=21, color=TEXT, indent=360, after=60))

    body.append(paragraph_xml('7. Estado actual y observaciones relevantes', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('La integración ya es funcional y útil, pero también deja visibles las siguientes decisiones del estado actual del proyecto:', size=21, color=TEXT, after=120))
    for item in [
        'El pipeline sí ejecuta tests, pero todavía no los usa como quality gate estricto porque la etapa está escrita con npm test || true.',
        'La etapa Code Quality Check es por ahora una validación mínima del entorno; no ejecuta ESLint, análisis estático ni escaneo de seguridad.',
        'El push a registry quedó preparado en el Jenkinsfile, pero requiere credenciales reales para activar docker login y docker push.',
        'El despliegue automatizado actual es local y condicionado a la rama main; aún no apunta a staging o producción gestionada.'
    ]:
        body.append(paragraph_xml(f'- {item}', size=21, color=TEXT, indent=360, after=60))
    body.append(table_xml([
        [cell_xml(paragraph_xml('Observación importante: si el objetivo es que Jenkins bloquee regresiones antes de integrar cambios, el siguiente ajuste lógico es reemplazar npm test || true por npm test e incorporar una etapa real de lint o análisis estático.', size=20, color='78350F', after=60), 9360, fill=YELLOW)]
    ], [9360]))
    body.append(empty_paragraph())

    body.append(paragraph_xml('8. Resultado obtenido', bold=True, size=32, color=NAVY, after=80, before=80))
    body.append(paragraph_xml('La integración de Jenkins profesionaliza la segunda parte del proyecto AHP: centraliza la automatización, reduce fricción operativa y convierte el build Docker en un artefacto repetible. Además, al combinar contenedor Jenkins, volumen persistente, acceso a Docker del host y lógica de etiquetas latest/stable, el pipeline ya no se limita a compilar; también participa en la entrega local del sistema.', size=21, color=TEXT, after=120))
    body.append(table_xml([
        [
            title_body_cell('Confiabilidad', 'El flujo técnico ya no depende sólo de correr pasos manuales en local.', 3120, SOFT_RED),
            title_body_cell('Trazabilidad', 'Cada build puede seguir una secuencia estándar de validación, imagen y despliegue.', 3120, SOFT_GRAY),
            title_body_cell('Escalabilidad', 'La base queda preparada para completar push a registry y evolucionar hacia despliegues cloud-ready.', 3120, SOFT_BLUE)
        ]
    ], [3120, 3120, 3120]))
    body.append(empty_paragraph())

    body.append(paragraph_xml('9. Próximos pasos recomendados', bold=True, size=32, color=NAVY, after=80, before=80))
    for item in [
        'Convertir la etapa de tests en una compuerta real de calidad eliminando el || true.',
        'Agregar una etapa formal de lint, reportes de cobertura y publicación de artefactos de test.',
        'Completar la integración con Docker Hub u otro registro seguro mediante credenciales en Jenkins.',
        'Extender el deploy desde local hacia un entorno objetivo alineado con la estrategia cloud-ready de AHP.'
    ]:
        body.append(paragraph_xml(f'- {item}', size=21, color=TEXT, indent=360, after=60))

    body.append(paragraph_xml('AHP · Documentación de integración Jenkins · generado desde el estado actual del repositorio', size=18, color=MUTED, align='center', before=180))

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<w:body>'
        f'{"".join(body)}'
        '<w:sectPr>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1020" w:right="1134" w:bottom="1020" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>'
        '</w:sectPr>'
        '</w:body>'
        '</w:document>'
    )


def build_styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:docDefaults>'
        '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:rPrDefault>'
        '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
        '</w:docDefaults>'
        '</w:styles>'
    )


def build_content_types_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '</Types>'
    )


def build_root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def build_document_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )


def build_core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>Implementación de Jenkins en AHP</dc:title>'
        '<dc:subject>Integración de CI/CD para Academic Hiring Platform</dc:subject>'
        '<dc:creator>GitHub Copilot</dc:creator>'
        '<cp:lastModifiedBy>GitHub Copilot</cp:lastModifiedBy>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        '</cp:coreProperties>'
    )


def build_app_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>GitHub Copilot</Application>'
        '</Properties>'
    )


def generate_docx() -> Path:
    with ZipFile(OUTPUT, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', build_content_types_xml())
        archive.writestr('_rels/.rels', build_root_rels_xml())
        archive.writestr('docProps/core.xml', build_core_xml())
        archive.writestr('docProps/app.xml', build_app_xml())
        archive.writestr('word/document.xml', build_document_xml())
        archive.writestr('word/styles.xml', build_styles_xml())
        archive.writestr('word/_rels/document.xml.rels', build_document_rels_xml())
    return OUTPUT


def validate_docx(path: Path) -> None:
    with ZipFile(path) as archive:
        required = {
            '[Content_Types].xml',
            '_rels/.rels',
            'docProps/core.xml',
            'word/document.xml',
            'word/styles.xml',
            'word/_rels/document.xml.rels'
        }
        missing = required.difference(archive.namelist())
        if missing:
            raise RuntimeError(f'DOCX incompleto, faltan entradas: {sorted(missing)}')


def main() -> None:
    path = generate_docx()
    validate_docx(path)
    print(path)


if __name__ == '__main__':
    main()