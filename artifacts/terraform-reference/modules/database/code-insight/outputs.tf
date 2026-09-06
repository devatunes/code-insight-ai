# Expone el nombre de la tabla para inyectarlo como env var del backend.
output "table_name" {
  value = aws_dynamodb_table.analyses.name
}

# Expone el ARN de la tabla para permisos IAM finos en el rol del task de Fargate.
output "table_arn" {
  value = aws_dynamodb_table.analyses.arn
}
