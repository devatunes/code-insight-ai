#!/usr/bin/env bash
# Build de Angular (producción) + sync a S3 + invalidación de CloudFront.
# Requiere que el backend ya esté desplegado (deploy-backend.sh primero):
# el módulo frontend necesita el DNS del ALB para armar la distribución.
set -euo pipefail

AWS_REGION="us-east-1"
IAC_DIR="../app-iac"

if [[ -z "${TF_VAR_code_insight_anthropic_api_key:-}" ]]; then
  echo "Falta TF_VAR_code_insight_anthropic_api_key en el entorno (el módulo backend la sigue necesitando)." >&2
  exit 1
fi

if [[ -z "${TF_VAR_code_insight_frontend_bucket_name:-}" ]]; then
  echo "Falta TF_VAR_code_insight_frontend_bucket_name (nombre unico global de bucket S3)." >&2
  exit 1
fi

echo "==> 1/4 terraform apply: crea/actualiza CloudFront + S3"
(cd "$IAC_DIR" && terraform apply -auto-approve \
  -target=module.code_insight_database \
  -target=module.code_insight_backend \
  -target=module.code_insight_frontend)

BUCKET=$(cd "$IAC_DIR" && terraform output -raw code_insight_frontend_bucket_name)
DISTRIBUTION_ID=$(cd "$IAC_DIR" && terraform output -raw code_insight_cloudfront_distribution_id)

echo "==> 2/4 build de producción"
(cd frontend && npm run build -- --configuration production)

echo "==> 3/4 sync a s3://$BUCKET"
aws s3 sync frontend/dist/frontend/browser "s3://$BUCKET" --region "$AWS_REGION" --delete

echo "==> 4/4 invalidando cache de CloudFront ($DISTRIBUTION_ID)"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null

echo "Listo. URL pública:"
(cd "$IAC_DIR" && terraform output -raw code_insight_cloudfront_domain_name)
