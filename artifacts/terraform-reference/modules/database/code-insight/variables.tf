# Define el prefijo comun usado para nombrar los recursos de este modulo.
variable "name_prefix" {
  description = "Prefijo comun para nombres de recursos de la base de datos de code-insight"
  type        = string
}

# Permite etiquetar todos los recursos del modulo de forma consistente.
variable "tags" {
  description = "Tags comunes para los recursos del modulo database/code-insight"
  type        = map(string)
  default     = {}
}
