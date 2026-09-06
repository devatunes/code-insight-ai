# Stack de "Code Insight AI" — analiza repos publicos e infiere su
# arquitectura. Cuarto stack en esta cuenta (Contably, wedding, y el ya
# destruido Assessment), completamente independiente de los demas: no
# reusa ningun modulo de assessment_* ni de contably.
#
# A diferencia de Assessment (que arrancó con Lambda sin VPC, optimizado
# por costo puro, y tuvo que destruirse), acá se va directo con la
# arquitectura correcta desde el dia uno: VPC privada + ALB + ECS Fargate +
# DynamoDB via VPC Gateway Endpoint (sin NAT Gateway). Ver
# code-insight-ai/artifacts/ARCHITECTURE.md para la justificacion completa
# componente por componente.
#
# Orden de los modulos = orden real de dependencia: la tabla no depende de
# nada, el backend depende de la tabla (IAM + nombre), el frontend depende
# del backend (DNS del ALB, para que CloudFront le haga proxy a /api/*).

# 1. Tabla DynamoDB — sin dependencias.
module "code_insight_database" {
  source = "./modules/database/code-insight"

  name_prefix = var.code_insight_name_prefix
  tags        = merge(var.tags, { App = "code-insight-ai" })
}

# 2. VPC + ALB + ECS Fargate — depende de la tabla (nombre + ARN para el IAM
# policy del task role).
module "code_insight_backend" {
  source = "./modules/backend/code-insight"

  name_prefix = var.code_insight_name_prefix
  aws_region  = var.aws_region
  vpc_cidr    = var.code_insight_backend_vpc_cidr

  dynamodb_table_name = module.code_insight_database.table_name
  dynamodb_table_arn  = module.code_insight_database.table_arn

  anthropic_api_key = var.code_insight_anthropic_api_key
  image_tag         = var.code_insight_image_tag

  tags = merge(var.tags, { App = "code-insight-ai" })
}

# 3. CloudFront + S3 — depende del DNS del ALB para proxyar /api/* al backend.
module "code_insight_frontend" {
  source = "./modules/frontend/code-insight"

  bucket_name          = var.code_insight_frontend_bucket_name
  backend_alb_dns_name = module.code_insight_backend.alb_dns_name

  tags = merge(var.tags, { App = "code-insight-ai" })
}
