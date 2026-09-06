# Descubre zonas disponibles para repartir subnets en mas de una AZ.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
}

# VPC dedicada al backend de code-insight-ai. Las tasks de Fargate en
# subnets privadas llegan a los servicios de AWS (ECR, CloudWatch Logs,
# DynamoDB, SSM) via VPC Endpoints, sin salir a internet para eso — pero sí
# necesitan salida real a internet para clonar repos Git públicos (ver NAT
# Gateway más abajo), que es la función núcleo de esta app. La única
# entrada pública real sigue siendo el ALB, que recibe desde CloudFront.
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# Subnets publicas: solo viven acá el ALB y los VPC Interface Endpoints.
resource "aws_subnet" "public" {
  count = length(local.availability_zones)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Subnets privadas: donde corren las tasks de Fargate. Sin ruta a internet.
resource "aws_subnet" "private" {
  count = length(local.availability_zones)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 100)
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
  })
}

# NAT Gateway: a diferencia de un backend "normal" que solo habla con
# servicios de AWS (cubiertos por los VPC Endpoints de arriba), la funcion
# nucleo de esta app es clonar repos Git publicos — hosts arbitrarios de
# internet (github.com, gitlab.com, etc), no servicios de AWS. No hay VPC
# Endpoint posible para eso. Sin NAT, la task ni siquiera puede resolver
# DNS de github.com. Es la unica pieza de la arquitectura "cara por hora"
# que no se puede evitar sin cambiar lo que la app hace.
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-eip" })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat" })

  depends_on = [aws_internet_gateway.this]
}

# Tabla de rutas privada: todo el trafico saliente (git clone a hosts
# publicos) pasa por el NAT, nunca la task tiene IP publica propia ni
# acepta trafico entrante directo de internet.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-rt"
  })
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Security group para los VPC Interface Endpoints (ECR, CloudWatch Logs):
# solo acepta HTTPS desde dentro de la propia VPC.
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.name_prefix}-endpoints-"
  description = "Permite HTTPS desde la VPC hacia los VPC endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS desde la VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-endpoints-sg"
  })
}

# Gateway endpoints (gratis, sin costo por hora): S3 (ECR guarda las capas
# de imagen ahí) y DynamoDB (la tabla de historial).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(var.tags, { Name = "${var.name_prefix}-s3-endpoint" })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(var.tags, { Name = "${var.name_prefix}-dynamodb-endpoint" })
}

# Interface endpoints (con costo por hora, pero igual mas barato que un NAT
# Gateway fijo): ECR API, ECR Docker registry y CloudWatch Logs — lo minimo
# que una task de Fargate necesita para arrancar y loguear sin salir a internet.
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecr-api-endpoint" })
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecr-dkr-endpoint" })
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-logs-endpoint" })
}

# El rol de ejecucion de ECS resuelve ANTHROPIC_API_KEY desde SSM en
# runtime (ver ecs.tf, bloque "secrets") — sin este endpoint la task nunca
# arranca: se queda reintentando "unable to retrieve secrets from ssm"
# hasta agotar el timeout, porque no hay NAT para salir a buscarlo.
resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ssm"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-ssm-endpoint" })
}
