variable "bucket_name" {
  description = "Nombre globalmente unico del bucket S3 para el frontend de code-insight-ai"
  type        = string
}

variable "backend_alb_dns_name" {
  description = "DNS name del ALB del backend, usado como origen de /api/* en CloudFront"
  type        = string
}

variable "tags" {
  description = "Tags comunes para los recursos del frontend"
  type        = map(string)
  default     = {}
}
