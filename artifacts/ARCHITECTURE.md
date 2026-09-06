# Arquitectura — justificación componente por componente

Una sola arquitectura (no una versión "barata" y otra "objetivo" como en
`assessment-cloud`): pensada para funcionar bien con tráfico bajo y poder
escalar sin rediseño. Terraform de referencia en
[`../../app-iac/code-insight.tf`](../../app-iac/code-insight.tf) y
`modules/*/code-insight`.

## CloudFront + S3 (frontend)

**Por qué:** Angular compila a archivos estáticos — no necesitan servidor
corriendo, solo servirse rápido. CloudFront cachea en el borde y S3 es el
storage más barato de AWS para esto.

**Alternativa descartada — servir el build desde el mismo backend:**
mezcla dos responsabilidades muy distintas (contenido estático vs API con
estado) en el mismo contenedor, y pierde el cacheo global de CloudFront.

## La misma distribución CloudFront proxya `/api/*` al backend

**Por qué:** frontend y backend quedan en el mismo dominio — sin CORS real
que configurar y sin necesidad de exponer el ALB con su propio certificado
HTTPS (CloudFront ya termina TLS del lado del usuario).

**Alternativa descartada — dominios separados con CORS:** funciona, pero
suma una superficie de configuración (orígenes permitidos, preflight) que
no aporta nada acá — no hay un motivo real para que frontend y backend
vivan en dominios distintos.

## ALB + ECS Fargate (backend)

**Por qué:** el backend clona repos Git — procesos de duración variable que
necesitan disco temporal real. Fargate corre en un contenedor con recursos
dedicados y sin límite agresivo de tiempo/espacio.

**Alternativa descartada — Lambda (lo que usaba `assessment-cloud`):** el
límite de 15 min de ejecución y el `/tmp` efímero son un riesgo real justo
en la funcionalidad núcleo de esta app — clonar un repo grande. Con Fargate
ese riesgo desaparece.

**Alternativa descartada — App Runner:** más simple de configurar (menos
piezas que armar a mano), pero da menos control sobre la VPC y el
auto-scaling fino.

**Alternativa descartada — EC2 directo:** requiere gestionar el sistema
operativo y parches, sin auto-scaling ni despliegue por contenedor sin
trabajo extra.

## Security Group del ALB restringido a IPs de CloudFront

**Por qué:** el ALB no necesita aceptar tráfico de cualquier IP de
internet — solo del edge de CloudFront que le hace de proxy. Se usa la
managed prefix list `com.amazonaws.global.cloudfront.origin-facing` de AWS
en vez de mantener una lista de IPs a mano.

## VPC privada, con VPC Endpoints + NAT Gateway

**Por qué VPC Endpoints:** las tasks de Fargate llegan a ECR (para
arrancar), CloudWatch Logs (para escribir), SSM (para la API key) y
DynamoDB (para el historial) sin necesitar una ruta abierta a internet —
esos 4 son servicios de AWS conocidos de antemano.

**Por qué además NAT Gateway (corrección sobre el diseño inicial):** la
función núcleo de esta app es clonar repos Git **públicos** — hosts
arbitrarios fuera de AWS (github.com, gitlab.com, etc.), no servicios de
AWS. No existe un VPC Endpoint para "internet en general". El diseño
original asumía que los VPC Endpoints alcanzaban y se armó sin NAT — al
probar el flujo real (`git clone` desde la task), la conexión nunca
progresaba porque no había ninguna ruta de salida a internet. El NAT se
agregó recién ahí, verificado con un análisis real de punta a punta.

**Alternativa descartada — asignarle IP pública directa a la task (sin
NAT, sin subnet privada):** ahorra el costo del NAT, pero la task quedaría
alcanzable directo desde internet en su propia IP — peor postura de
seguridad que "sin IP pública, egress solo vía NAT", por un ahorro menor
al pensado en la práctica.

**Alternativa descartada — sin VPC, todo público (lo que hacía
`assessment-cloud` "actual"):** ahorra el costo de los VPC endpoints, pero
deja el backend sin la capa de aislamiento de red que sí es la práctica
correcta por defecto, no una que se "gana" solo con tráfico alto.

## DynamoDB (no relacional)

**Por qué:** un análisis es un documento con listas anidadas (componentes,
tecnologías, hallazgos) — no hay relaciones muchos-a-muchos ni joins entre
entidades que justifiquen una base relacional. El patrón de acceso real es
"guardar uno, listar los últimos N, leer uno por id".

**Alternativa descartada — PostgreSQL/RDS:** sería relacional solo de
nombre (una tabla, sin joins reales) y suma una instancia corriendo 24/7 —
Dynamo con `PAY_PER_REQUEST` no cobra nada en reposo.

**Alternativa descartada — SQLite embebido en el contenedor:** el
historial se perdería cada vez que Fargate recicla el task (deploys,
auto-scaling, restart por salud) — inaceptable para algo llamado
"historial".

## SSM Parameter Store para la API key de Anthropic

**Por qué:** la key nunca debe estar en el task definition en texto plano
ni en el código — SSM la guarda cifrada (`SecureString`) y el rol de
ejecución de ECS la resuelve en runtime vía el bloque `secrets` del
container definition, nunca vía `environment`.

## Sin RDS Proxy ni réplicas de lectura

**Por qué no:** con el tráfico real de una demo/sustentación, no hay carga
que justifique esa complejidad todavía. Documentado como siguiente paso
cuando el volumen lo justifique, no construido de antemano para una escala
que no existe.
