# Terraform de referencia — infraestructura real desplegada

Copia de solo lectura de los módulos de Terraform que **realmente crearon**
la infraestructura en AWS de este proyecto (no es una arquitectura futura
ni un ejemplo hipotético — a diferencia del `terraform-target/` de la kata
anterior, esto es lo que corre en producción ahora mismo).

**No es el origen de la verdad.** El state real, las variables con
secretos/nombres de cuenta y el `terraform.tfvars` viven en el repo privado
de infraestructura del equipo, compartido entre varios proyectos (no solo
este). Esta carpeta es una copia exportada de esos módulos para que quede
documentado en este repo público qué se desplegó y por qué — no se puede
correr `terraform apply` directo desde acá porque falta el `provider`/backend
del state y las variables reales (nombre de bucket, API key de Anthropic, etc.).

Justificación componente por componente de por qué esta arquitectura y no
otra: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Qué incluye

| Ruta | Qué crea |
|---|---|
| `root/code-insight.tf` | Wiring de los 3 módulos (orden real de dependencia: tabla → backend → frontend). |
| `modules/database/code-insight/dynamodb.tf` | Tabla DynamoDB (pay-per-request) para el historial de análisis. |
| `modules/backend/code-insight/network.tf` | VPC propia, subnets públicas/privadas, NAT Gateway, VPC Endpoints (ECR, CloudWatch Logs, SSM, DynamoDB). |
| `modules/backend/code-insight/alb.tf` | ALB + target group (health check en `/api`, `deregistration_delay = 60`) + listener HTTP, SG restringido a la prefix list de CloudFront. |
| `modules/backend/code-insight/ecs.tf` | Cluster, task definition y service Fargate del backend NestJS. |
| `modules/backend/code-insight/ecr.tf` | Repositorio ECR (`scan_on_push = true`) para la imagen del backend. |
| `modules/backend/code-insight/ssm.tf` | Parámetro SecureString con la API key de Anthropic. |
| `modules/frontend/code-insight/s3.tf` | Bucket privado (sin acceso público) para el build de Angular. |
| `modules/frontend/code-insight/cloudfront.tf` | Distribución CloudFront: sirve el frontend desde S3 (OAC) y proxya `/api/*` al ALB. |

## Qué NO incluye a propósito

- `terraform.tfvars` / valores reales de variables (nombre de bucket, región,
  API key) — son específicos de la cuenta de AWS donde se desplegó.
- Backend de state (S3 + DynamoDB lock del propio Terraform) — vive
  configurado en el repo privado de infraestructura, compartido por los
  demás proyectos de esa cuenta.
- Pipeline de CI/CD para publicar la imagen a ECR — `deploy-backend.sh` y
  `deploy-frontend.sh` en la raíz del repo documentan el proceso manual
  usado para esta entrega.
