# Tabla unica, un item = un analisis (facts + resultado de la IA anidados,
# sin tablas relacionadas). Pay-per-request porque el trafico es bajo y
# esporadico (una demo/kata), no una carga sostenida que justifique
# capacidad provisionada.
resource "aws_dynamodb_table" "analyses" {
  # Nombre estable derivado del prefijo del stack.
  name = "${var.name_prefix}-analyses"
  # Modo bajo demanda: sin capacidad que aprovisionar ni pagar en reposo.
  billing_mode = "PAY_PER_REQUEST"
  # Clave de particion unica: el id (uuid) de cada analisis.
  hash_key = "id"

  # Declara el atributo de particion.
  attribute {
    name = "id"
    type = "S"
  }

  # Recuperacion punto-en-el-tiempo: red de seguridad barata contra un
  # borrado o escritura accidental del historial.
  point_in_time_recovery {
    enabled = true
  }

  # Etiqueta la tabla para inventario y costos.
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-analyses"
  })
}
