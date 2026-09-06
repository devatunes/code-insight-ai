export const environment = {
  production: true,
  // Relativo a propósito: en AWS, CloudFront enruta /api/* al ALB del
  // backend y el resto a S3 — mismo dominio, sin CORS real.
  apiUrl: '/api',
};
