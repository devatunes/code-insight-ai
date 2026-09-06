variable "name_prefix" {
  description = "Prefijo comun para nombrar los recursos del backend de code-insight"
  type        = string
  default     = "code-insight-backend"
}

variable "aws_region" {
  description = "Region de AWS donde se despliega (usada en VPC endpoints y logs)"
  type        = string
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC dedicada al backend"
  type        = string
}

variable "container_port" {
  description = "Puerto en el que escucha el contenedor del backend NestJS"
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "CPU units de Fargate para la task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memoria en MB de Fargate para la task"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Cantidad de tasks corriendo en paralelo detras del ALB"
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Tag de la imagen en ECR a desplegar (actualizado por deploy-backend.sh)"
  type        = string
  default     = "latest"
}

variable "log_retention_in_days" {
  description = "Dias de retencion de logs en CloudWatch"
  type        = number
  default     = 7
}

variable "anthropic_api_key" {
  description = "API key de Anthropic (Claude) — se guarda cifrada en SSM, nunca en texto plano"
  type        = string
  sensitive   = true
}

variable "anthropic_model" {
  description = "Modelo de Claude a usar"
  type        = string
  default     = "claude-sonnet-5"
}

variable "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB de historial (del modulo database/code-insight)"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN de la tabla DynamoDB de historial, para el IAM policy del task role"
  type        = string
}

variable "tags" {
  description = "Tags comunes para los recursos del backend"
  type        = map(string)
  default     = {}
}
