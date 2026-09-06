#!/usr/bin/env bash
# Build + push de la imagen del backend a ECR, y terraform apply de los 3
# módulos de code-insight-ai (database, backend, frontend — en ese orden
# de dependencia). Requiere: docker, aws cli configurado con la cuenta
# correcta, terraform, y TF_VAR_code_insight_anthropic_api_key exportada
# (nunca va en terraform.tfvars — ver README).
set -euo pipefail

AWS_REGION="us-east-1"
NAME_PREFIX="code-insight"
IAC_DIR="../app-iac"

if [[ -z "${TF_VAR_code_insight_anthropic_api_key:-}" ]]; then
  echo "Falta TF_VAR_code_insight_anthropic_api_key en el entorno. Ejemplo:" >&2
  echo '  export TF_VAR_code_insight_anthropic_api_key="sk-ant-..."' >&2
  exit 1
fi

if [[ -z "${TF_VAR_code_insight_frontend_bucket_name:-}" ]]; then
  echo "Falta TF_VAR_code_insight_frontend_bucket_name (nombre unico global de bucket S3)." >&2
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${NAME_PREFIX}-backend"
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || date +%s)

echo "==> 1/4 terraform apply: crea/actualiza ECR (y el resto de la red) si falta"
(cd "$IAC_DIR" && terraform apply -auto-approve \
  -target=module.code_insight_database \
  -target=module.code_insight_backend.aws_ecr_repository.backend)

echo "==> 2/4 build + push de la imagen ($ECR_URL:$IMAGE_TAG)"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build --platform linux/amd64 -t "$ECR_URL:$IMAGE_TAG" -t "$ECR_URL:latest" ./backend
docker push "$ECR_URL:$IMAGE_TAG"
docker push "$ECR_URL:latest"

echo "==> 3/4 terraform apply: crea/actualiza VPC, ALB, ECS Fargate con el nuevo tag de imagen"
(cd "$IAC_DIR" && terraform apply -auto-approve \
  -target=module.code_insight_database \
  -target=module.code_insight_backend \
  -var="code_insight_image_tag=${IMAGE_TAG}")

echo "==> 4/4 fuerza un nuevo deployment del servicio ECS (por si el tag no cambió)"
CLUSTER=$(cd "$IAC_DIR" && terraform output -raw code_insight_ecs_cluster_name 2>/dev/null || echo "${NAME_PREFIX}-cluster")
SERVICE=$(cd "$IAC_DIR" && terraform output -raw code_insight_ecs_service_name 2>/dev/null || echo "${NAME_PREFIX}-backend")
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment >/dev/null

echo "Listo. DNS del ALB:"
(cd "$IAC_DIR" && terraform output -raw code_insight_alb_dns_name 2>/dev/null) || true
