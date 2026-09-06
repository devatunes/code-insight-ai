# Code Insight AI

Ingeniería inversa automatizada de repositorios: pegás la URL pública de un
repo Git, y la app lo clona, extrae hechos concretos de su estructura
(lenguaje, framework, componentes por carpeta), se los pasa a Claude para
que redacte un resumen funcional e infiera el patrón de arquitectura
(Monolito, MVC, Clean Architecture, Hexagonal, Microservicios o N-Capas),
y muestra todo — incluido un diagrama — en una interfaz Angular. Cada
análisis queda guardado en un historial consultable.

- **Código de la app** (backend + frontend): este repositorio.
- **Infraestructura como código real**: el Terraform que realmente desplegó
  todo esto vive en el repo privado de infraestructura del equipo (compartido
  con otros proyectos, no público) — por eso [`artifacts/terraform-reference/`](artifacts/terraform-reference/)
  trae una copia de solo lectura de esos módulos, sin variables ni secretos
  de cuenta, para que quede documentado qué se desplegó y por qué.
- **Desplegado en AWS**: [`d1obit4fp2ujij.cloudfront.net`](https://d1obit4fp2ujij.cloudfront.net)

## Índice

- [Cómo funciona el análisis](#cómo-funciona-el-análisis)
- [Tecnologías y patrones soportados](#tecnologías-y-patrones-soportados)
- [Patrones y arquitectura del backend](#patrones-y-arquitectura-del-backend)
- [Proveedores de IA — Strategy/Adapter](#proveedores-de-ia--strategyadapter)
- [Arquitectura AWS](#arquitectura-aws)
- [Estructura del repo](#estructura-del-repo)
- [Ejecutar en local](#ejecutar-en-local)
- [Tests](#tests)
- [Desplegar en AWS](#desplegar-en-aws)
- [Supuestos y decisiones de alcance](#supuestos-y-decisiones-de-alcance)
- [Qué haría con más tiempo](#qué-haría-con-más-tiempo)

## Cómo funciona el análisis

Es un pipeline híbrido, no "todo se lo preguntamos a la IA":

1. **Ingesta** (`backend/src/ingestion`) — clona el repo con `git clone
   --depth 1`, con timeout y límite de tamaño, a un directorio temporal que
   se borra siempre al terminar (éxito o error). Nunca se ejecuta código del
   repo analizado, solo se lee su estructura.
2. **Heurística local** (`backend/src/static-analysis`) — determinista, sin
   red: cuenta archivos, lee **todos** los manifiestos de dependencias del
   repo (no solo en la raíz — ver [Tecnologías y patrones
   soportados](#tecnologías-y-patrones-soportados)) para detectar
   lenguaje/framework, y detecta componentes por convención de **carpeta**
   (`controllers/`, `ports/`, `adapters/`...) o por **nombre de archivo**
   (`*.controller.ts`, `OwnerController.java`...). Esto son los **hechos
   duros** — verificables, testeados con fixtures, nunca inventados.
3. **IA** (`backend/src/ai`) — Claude recibe esos hechos como contexto (no
   el código fuente completo) y devuelve, en un único JSON con schema
   forzado (tool use, no texto libre a parsear): el resumen funcional, la
   arquitectura inferida, la evidencia que la sustenta, hallazgos
   (recomendaciones/riesgos), y el diagrama en Mermaid.
4. **Historial** (`backend/src/history`) — el análisis completo queda en
   DynamoDB, consultable después desde la página de historial.

Este diseño existe porque uno de los criterios de evaluación es "exactitud
de hallazgos" — los conteos y detecciones no dependen de que un LLM no
alucine, dependen de código determinista. La IA solo interpreta y redacta.

## Tecnologías y patrones soportados

Todo lo que sigue es heurística **determinista** (`backend/src/static-analysis`),
no algo que decide Claude — por eso es exacto, testeado, y extendible sin
tocar el prompt de la IA.

**Lenguaje/framework** (`tech-detector.service.ts`) — lee **todos** los
manifiestos de dependencias del repo, no solo el de la raíz (necesario en
monorepos tipo `backend/`+`frontend/`):

| Manifiesto | Lenguaje | Frameworks detectados |
|---|---|---|
| `package.json` (cualquier nivel) | JavaScript/TypeScript | NestJS, Express, Angular, React, Vue, Next.js |
| `pom.xml` | Java | Spring Boot |
| `requirements.txt` / `pyproject.toml` / `Pipfile` / `setup.py` / `manage.py` | Python | Django (por `manage.py` o por manifiesto), Flask |
| `Gemfile` | Ruby | Ruby on Rails |
| `composer.json` | PHP | Laravel |
| `go.mod` | Go | Gin, Echo, Fiber, Beego, Gorilla Mux |

El lenguaje **principal** (`primaryLanguage`) además se calcula por conteo
de extensión de archivo, y cubre más lenguajes que los de la tabla (C#,
Rust, Kotlin, Swift, Scala, Dart) aunque todavía no tengan detección de
framework propia (ver [Qué haría con más tiempo](#qué-haría-con-más-tiempo)).

**Componentes** (`architecture-heuristics.service.ts`) — por carpeta
(`controllers/`, `services/`, `repositories/`, `models/`/`entities/`,
`ports/`, `adapters/`, `use-cases/`, `dto/`, `components/`) **o** por
nombre de archivo, cubriendo tres convenciones reales distintas:

| Convención | Ejemplo | Lenguaje típico |
|---|---|---|
| Sufijo `.controller.ts`, `.service.ts`, `.module.ts`, `.guard.ts`, `.strategy.ts`, `.component.ts` | `assessments.controller.ts` | TypeScript (NestJS/Angular) |
| Sufijo `Controller.java`, `Service.java`, `Repository.java`, `Entity.java`, `Dto.java` (PascalCase, sin punto) | `OwnerController.java` | Java (Spring) |
| Nombre de archivo completo (`routers.go`, `handlers.go`, `services.go`, `repositories.go`, `models.go`, `serializers.go`, `middlewares.go`) — convención Go de "paquete por feature", donde el nombre del archivo entero es el rol, no un sufijo | `articles/routers.go` | Go |

**Arquitectura** — 6 patrones del brief, cada uno con evidencia de carpetas
(nombres flexibles: Clean Architecture acepta `usecase`/`use-cases`/`app`
como capa de aplicación e `infrastructure`/`repository`/`delivery`/`adapter`
como capa de infraestructura; Hexagonal acepta `Infrastructure/` además de
`adapter/` literal; Microservicios detecta carpetas de nivel superior por
sufijo — `customers-service`, `api-gateway` — no solo el nombre literal
`services/`) o de componentes detectados. Probado contra **~23 repos
públicos reales** de lenguajes y arquitecturas distintas (Java/Spring,
Python/Django y Flask, Ruby/Rails, Go, C#/.NET, PHP/Laravel y Hexagonal,
React, Vue, Rust, Kotlin, Elixir/Phoenix, Scala/Play, TypeScript/Hexagonal,
monorepos de microservicios y monorepos grandes reales, más casos límite
como un repo casi vacío y dos repos de gran tamaño para probar el límite
de tamaño de clone) — ver el historial de commits para el detalle de qué
falló y qué se corrigió en cada ronda.

**Cómo agregar soporte a algo nuevo** (sin tocar el prompt de Claude):
- Nuevo framework de un lenguaje ya cubierto → una línea en
  `FRAMEWORK_DEPENDENCY_HINTS` (`tech-detector.service.ts`).
- Nuevo lenguaje con su propio manifiesto (ej. `Gemfile` para Ruby,
  `go.mod` para Go) → un bloque nuevo en `detect()` (mismo archivo),
  siguiendo el patrón de `pom.xml`/`requirements.txt`.
- Nueva convención de nombrado de componentes → una entrada en
  `FILENAME_SUFFIX_RULES`, `FILENAME_EXACT_RULES` o `COMPONENT_RULES`
  (`architecture-heuristics.service.ts`).

**Limitación conocida:** C#, Rust, Kotlin, Swift, Scala y Dart solo se
detectan como lenguaje principal (por extensión de archivo) — no tienen
detección de framework ni convención de componentes propia todavía, a
diferencia de Go, que sí la tiene (ver tablas arriba).

## Patrones y arquitectura del backend

- **Módulos por dominio** (NestJS) — `ingestion`, `static-analysis`, `ai`,
  `analysis` (orquestador), `history` — cada uno autocontenido.
- **Strategy/Adapter** para proveedores de IA (ver siguiente sección).
- **DTOs + `class-validator`** para validación centralizada de entrada.
- **Sin capa `*.repository.ts` propia** — `history.service.ts` habla
  directo con el SDK de DynamoDB, igual de simple que el caso de uso (un
  documento por análisis, sin relaciones que justifiquen una capa extra).

## Proveedores de IA — Strategy/Adapter

`ai/ai-provider.interface.ts` define un contrato único (`analyze(facts):
Promise<AiAnalysisResult>`). `ai/ai.module.ts` resuelve, vía variable de
entorno `AI_PROVIDER`, cuál implementación se inyecta — el resto del
backend nunca sabe cuál está activa.

| Proveedor | Estado |
|---|---|
| `claude` (Claude/Anthropic) | ✅ Funcional |
| `openai` | Adapter stub — mismo contrato, sin API real conectada |
| `gemini` | Adapter stub |
| `ollama` (modelo local) | Adapter stub — pensado para el caso de no poder mandar código a una API externa |

Cambiar de proveedor el día que se complete alguno de los stubs es cambiar
una variable de entorno, no tocar lógica de negocio.

## Arquitectura AWS

Una sola arquitectura, pensada para funcionar bien desde tráfico bajo y
poder escalar sin rediseño — a diferencia de la kata anterior
(`assessment-cloud`), acá no se arrancó con una versión "barata" para
después reemplazarla:

- **CloudFront + S3** — sirve el frontend Angular estático.
- **La misma distribución CloudFront** proxya `/api/*` al ALB del backend —
  frontend y backend quedan en el mismo dominio, sin CORS real y sin
  exponer el ALB por su propio HTTPS.
- **ALB + ECS Fargate**, dentro de una **VPC privada** — el Security Group
  del ALB solo acepta tráfico desde los rangos de IP de CloudFront (managed
  prefix list de AWS), no de cualquier IP de internet.
- **VPC Endpoints** para ECR, CloudWatch Logs, SSM y DynamoDB — las tasks de
  Fargate llegan a esos servicios de AWS sin salir a internet. **NAT
  Gateway** aparte, porque clonar repos Git públicos (github.com, etc.) sí
  requiere salida real a internet — no hay VPC Endpoint posible para hosts
  arbitrarios fuera de AWS. Es la única pieza de la arquitectura que no se
  pudo evitar con endpoints; sigue sin haber IP pública en las tasks ni
  tráfico entrante directo de internet.
- **DynamoDB** (no relacional) — un análisis es un documento con listas
  anidadas (componentes, hallazgos), no varias entidades relacionadas entre
  sí. Pay-per-request: sin capacidad que pagar en reposo.
- **La API key de Anthropic** vive cifrada en **SSM Parameter Store**, nunca
  en el task definition ni en el código — el rol de ejecución de ECS la lee
  en runtime.

Justificación componente por componente (por qué este y no otro):
[`artifacts/ARCHITECTURE.md`](artifacts/ARCHITECTURE.md).

## Estructura del repo

```
code-insight-ai/
  docker-compose.yml       # backend + frontend + DynamoDB Local, para desarrollo
  package.json             # scripts de dev y test
  deploy-backend.sh / deploy-frontend.sh
  backend/                 # NestJS + Dockerfile
    src/
      ingestion/            # git clone (funcional) + zip upload (cascarón)
      static-analysis/       # heurística local — hechos duros, con tests
      ai/                    # Strategy/Adapter de proveedores de IA
      analysis/              # orquestador — POST /analyses
      history/               # DynamoDB — GET /analyses, GET /analyses/:id
  frontend/                 # Angular 18 standalone + Dockerfile (nginx)
    src/app/
      pages/                 # analyze -> result -> history
      core/                  # AnalysisService (HTTP), modelos
      shared/                # wrapper del diagrama Mermaid
```

## Ejecutar en local

Requiere Docker y Node 24+.

```bash
git clone <este-repo>
cd code-insight-ai
cp backend/.env.example backend/.env   # completar ANTHROPIC_API_KEY
docker compose up --build
```

- Frontend: http://localhost:4200
- Backend: http://localhost:3000/api
- DynamoDB Local: se auto-crea la tabla al arrancar el backend (ver
  `history/dynamo.module.ts`) — no hace falta ningún paso manual.

Sin Docker (hot-reload):

```bash
npm run dev:db         # solo DynamoDB Local
npm run dev:backend    # cd backend && npm run start:dev
npm run dev:frontend   # cd frontend && npm start
```

## Tests

```bash
npm test   # backend (vitest) + frontend (karma/jasmine headless)
```

El backend cubre con tests unitarios la heurística de `static-analysis`
(conteo de archivos ignorando `node_modules`, detección de framework por
manifiestos anidados — no solo el de la raíz —, detección de componentes
por carpeta y por sufijo de archivo en dos convenciones — TypeScript y
Java —, e inferencia de hint de arquitectura) contra fixtures generadas en
un directorio temporal — sin red ni Claude real involucrados. El resto del
pipeline (ingestion, ai, analysis, history) no tiene tests unitarios
propios todavía — ver [Qué haría con más tiempo](#qué-haría-con-más-tiempo).

## Desplegar en AWS

```bash
cp .env.deploy.example .env.deploy   # completar con tu ANTHROPIC_API_KEY real
source .env.deploy
./deploy-backend.sh    # build+push a ECR, terraform apply (database+backend)
./deploy-frontend.sh   # terraform apply (frontend), build Angular, sync a S3, invalida CloudFront
```

`.env.deploy` nunca se commitea (está en `.gitignore`) — la API key de
Anthropic solo existe en SSM Parameter Store una vez aplicado el Terraform,
nunca en el repo.

## Supuestos y decisiones de alcance

- **Solo URL Git pública funciona de punta a punta.** La carga de ZIP tiene
  el endpoint y la interfaz (`ZipUploadService`) ya definidos con el mismo
  contrato que el clone de Git, pero lanza `NotImplementedException` — es
  un cascarón a propósito, dado el tiempo real disponible para esta kata.
- **Solo Claude está conectado.** OpenAI/Gemini/Ollama son adapters stub
  (ver [Proveedores de IA](#proveedores-de-ia--strategyadapter)) — el
  patrón está completo y es funcional, activarlos es agregar el SDK
  correspondiente dentro del `provider.ts` ya existente.
- **Sin autenticación.** No lo pide el alcance mínimo del reto; el
  historial queda compartido para cualquiera que use la app.

## Qué haría con más tiempo

- Ampliar detección de framework/componentes a los lenguajes que hoy solo
  se detectan por extensión (C#, Rust, Kotlin, Swift, Scala, Dart).
- Un reporte (no un proceso automático) que cruce, del historial en
  DynamoDB, los casos donde el hint de la heurística difiere del
  veredicto final de Claude — ya queda todo guardado (`facts.architectureHints`
  vs `ai.inferredArchitecture`), así que sería una señal útil para detectar
  gaps de la heurística sin tener que revisar caso por caso a mano.
  Deliberadamente NO como aprendizaje automático sin supervisión: si
  Claude se equivoca una vez, esa regla se metería como "hecho duro"
  permanente — justo lo contrario de por qué la heurística existe separada
  de la IA.
- Tests unitarios/e2e de `ingestion`, `ai` y `analysis` (mockeando Claude y
  el filesystem), no solo de `static-analysis`.
- Completar la carga de ZIP.
- Activar al menos un segundo proveedor de IA real — probablemente
  **Ollama** (modelo local), para dar independencia de red/costo en repos
  sensibles o entornos sin salida a internet, o Gemini por tener tier
  gratuito — para probar el patrón Strategy con un cambio de variable de
  entorno en vivo.
- HTTPS propio en el ALB (hoy CloudFront habla HTTP con el ALB dentro de la
  red de AWS — razonable a este tráfico, pero no es zero-trust interno).
- Observabilidad más profunda: hoy ya hay `Logger` de NestJS en los puntos
  clave (`git-clone.service.ts`, `analysis.service.ts`,
  `claude.provider.ts`, `dynamo.module.ts`) y errores tipados
  (`BadRequestException`, `PayloadTooLargeException`, etc., no throws
  genéricos) agregados en CloudWatch Logs — falta métricas/dashboards
  propios (CloudWatch Metrics), tracing distribuido (X-Ray) y alarmas.
