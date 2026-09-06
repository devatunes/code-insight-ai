locals {
  frontend_origin_id = "codeInsightFrontendS3"
  backend_origin_id  = "codeInsightBackendAlb"
}

# OAC para que CloudFront lea el bucket S3 de forma privada, sin exponerlo.
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.bucket_name}-oac"
  description                       = "Origin access control for code-insight-ai frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Una sola distribución sirve el frontend estático y proxya /api/* al ALB
# del backend — así quedan en el mismo dominio (sin CORS real, sin exponer
# el ALB por HTTPS propio).
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.frontend_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  # El ALB del backend solo escucha HTTP (dentro de la red de AWS,
  # CloudFront->ALB, no hace falta TLS ahí — el usuario final siempre habla
  # HTTPS con CloudFront).
  origin {
    domain_name = var.backend_alb_dns_name
    origin_id   = local.backend_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # Default es 30s — el pipeline completo (git clone + llamada a Claude)
      # puede tardar más que eso; 60s es el máximo sin pedir aumento de cuota.
      origin_read_timeout = 60
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.frontend_origin_id
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  # /api* (sin la barra) para que matchee tanto "/api" exacto como
  # "/api/analyses" — con "/api/*" la ruta exacta "/api" caía al frontend
  # por no tener nada después de la barra. Nunca se cachea y reenvía todo
  # (headers, query string, body vía todos los métodos) directo al backend.
  ordered_cache_behavior {
    path_pattern             = "/api*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.backend_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true
  }

  # Errores 403/404 del origen S3 (ruta de Angular sin archivo real) caen a
  # index.html para que el router de la SPA resuelva del lado cliente.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}
