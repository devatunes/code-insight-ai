# Lista administrada por AWS con los rangos de IP que usa CloudFront como
# origen saliente — restringe el ALB a "solo tráfico de CloudFront", no a
# cualquier IP de internet, sin tener que mantener la lista a mano.
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "Solo acepta HTTP entrante desde los edges de CloudFront"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "HTTP desde CloudFront"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_lb" "backend" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = var.tags
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name_prefix}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip" # requerido por Fargate (no hay instancias EC2 fijas)

  # Default de AWS es 300s — cada deploy dejaba la task vieja recibiendo
  # tráfico hasta 5 minutos, lo que hizo que más de una verificación en vivo
  # golpeara por error la versión anterior del código. 60s alcanza para que
  # un análisis en curso (clone + Claude, hasta ~60s por el timeout de
  # CloudFront hacia el origen) termine antes de cortar la conexión.
  deregistration_delay = 60

  health_check {
    path                = "/api"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener" "backend_http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
