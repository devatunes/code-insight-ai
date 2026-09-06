# Kata Senior - Fullstack/Cloud | Code Insight AI: Ingeniería Inversa Automatizada de Repositorios

> Texto original del reto, conservado como referencia — ver las decisiones de
> alcance ya cerradas en el [README](../README.md#supuestos-y-decisiones-de-alcance).

## 🚀 Challenge: Code Insight AI: Ingeniería Inversa Automatizada de Repositorios

### Contexto

En organizaciones con múltiples aplicaciones y equipos de desarrollo, frecuentemente se
reciben repositorios sin documentación actualizada, dificultando la comprensión de su
propósito, arquitectura y componentes principales.

Como Desarrollador Senior Full Stack Cloud, debes construir una solución que permita analizar
un repositorio de código fuente e inferir automáticamente información relevante sobre su
funcionamiento y arquitectura.

### Objetivo

Desarrollar una aplicación web que permita:

1. Seleccionar o cargar un repositorio de código fuente.
2. Analizar la estructura del proyecto.
3. Identificar componentes clave.
4. Generar automáticamente una descripción funcional de la aplicación.
5. Inferir la arquitectura utilizada.
6. Presentar los resultados mediante una interfaz amigable.

### Restricciones

**Tiempo**
- Desarrollo: máximo 4 horas.
- Sustentación: 8 minutos.

**Tecnologías permitidas**

Backend — elegir una de las siguientes opciones:
- Java (Spring Boot)
- Node.js (NestJS o Express)

Frontend:
- Angular

IA — puede utilizar:
- OpenAI
- Amazon Bedrock
- Claude
- Gemini
- Ollama / modelo local

**Restricción Banco**

Los funcionarios internos del banco:
- ✅ Pueden utilizar repositorios públicos o repositorios personales dummy.
- ❌ No pueden utilizar: repositorios internos del banco, código propietario,
  aplicaciones productivas, información sensible.

### Alcance mínimo esperado (MVP)

**Entrada** — la aplicación debe permitir una de estas opciones:
- Opción 1: ingresar URL Git pública (ej. `https://github.com/usuario/proyecto-demo`).
- Opción 2: cargar archivo ZIP de un proyecto.

**Proceso de análisis** — como mínimo debe identificar:

- *Información general*: nombre del proyecto, lenguaje principal, framework
  principal, cantidad aproximada de archivos.
- *Análisis funcional*: generar una explicación tipo "Esta aplicación es una
  API REST para gestión de clientes que permite crear, consultar, actualizar
  y eliminar registros utilizando Spring Boot y PostgreSQL."
- *Identificación de componentes*: por ejemplo Controllers, Services,
  Repositories, Models, Components Angular, APIs consumidas.
- *Arquitectura identificada* — debe inferir alguno de estos patrones:
  Monolito, MVC, Clean Architecture, Hexagonal, Microservicios, N-Capas.
  Mostrar además las evidencias encontradas.

**Interfaz Front** — pantalla simple con:
- Sección 1: carga de repositorio.
- Sección 2: resultado de análisis (resumen funcional, tecnologías
  detectadas, arquitectura inferida).
- Sección 3: hallazgos (componentes identificados, recomendaciones, riesgos
  detectados).

### Criterios de evaluación

1. **Diseño de Arquitectura** — separación de responsabilidades,
   escalabilidad, buenas prácticas, diseño de APIs.
2. **Backend** — calidad de código, estructura, patrones utilizados, manejo
   de errores.
3. **Frontend Angular** — experiencia de usuario, organización de
   componentes, consumo adecuado de APIs.
4. **Análisis e Ingeniería Inversa** — calidad del contexto generado,
   exactitud de hallazgos, interpretación de arquitectura.
5. **Comunicación Técnica** (durante la sustentación) — capacidad de
   síntesis, claridad conceptual, justificación de decisiones.

### Plus (no obligatorio)

- Generación de Diagrama de Arquitectura.
- Recomendaciones automáticas (ej. "Falta documentación", "No se evidencia
  manejo de errores", "Dependencias desactualizadas", "Posibles
  vulnerabilidades").

### AWS (valor agregado)

No es obligatorio desplegar. Puede:
- Opción A: desplegar la solución (ej. Angular → S3 + CloudFront, Backend →
  ECS Fargate o App Runner, Base de datos → RDS).
- Opción B: explicar el despliegue mediante diagrama.

### Entregables

**Obligatorios**

1. Código fuente — repositorio Git público.
2. Documento README — debe incluir: descripción de la solución,
   arquitectura implementada, tecnologías utilizadas, instrucciones de
   ejecución, supuestos realizados.
3. Presentación técnica — máximo 5 diapositivas, debe cubrir: Problema,
   Arquitectura, Solución implementada, Demo, Mejoras futuras.

### 🚨 Consideraciones de seguridad

- No subir credenciales reales ni secretos a repositorios públicos.
- Usar datos simulados en todos los ejemplos.
- Versionar el código en repositorios personales.
- Se recomienda el uso de `.gitignore` para excluir archivos sensibles.
- (Aviso interno del banco, tras un incidente previo en otra Kata: nunca usar
  repositorios reales/internos del banco ni exponer secrets — usar siempre
  cuentas y repos personales.)
