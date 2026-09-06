# La API key de Anthropic nunca va en el task definition como env var plana
# ni en el código: se guarda cifrada en SSM Parameter Store y el task role
# la lee en runtime (ver ecs.tf, bloque "secrets" del container).
resource "aws_ssm_parameter" "anthropic_api_key" {
  name  = "/${var.name_prefix}/anthropic-api-key"
  type  = "SecureString"
  value = var.anthropic_api_key

  tags = var.tags
}
