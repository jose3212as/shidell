# Casos de Prueba de Seguridad (Rúbrica de Seguridad)

Este documento contiene la especificación detallada de los Casos de Prueba de Seguridad diseñados y validados en el sistema, alineados con la rúbrica de la tarea (Broken Access Control, SQL Injection, Acceso no autorizado y DAST).

---

### Caso de Prueba: TC-SEC-001 (Control de Acceso / Mitigación de Broken Access Control)

| Campo | Descripción |
| :--- | :--- |
| **ID del Caso** | TC-SEC-001 |
| **Nombre** | Acceso denegado a ruta de Administrador para un usuario con rol Cliente ("ESTUDIANTE"). |
| **Requisito Asociado** | Rúbrica 2: "Matriz de Control de Acceso (Mitigación de A01: Broken Access Control). El sistema debe responder con HTTP 403 Forbidden cuando un cliente intente entrar a una ruta de admin." |
| **Prioridad** | Alta (Requisito Crítico de Seguridad). |
| **Precondiciones** | 1. El usuario "cliente@ejemplo.com" existe en la base de datos y tiene asignado el rol `"ESTUDIANTE"`. <br> 2. Se ha emitido un token de sesión válido para este usuario. <br> 3. El interceptor de autorización (`AuthInterceptor`) está activo. |
| **Datos de Prueba** | **Token:** Bearer token_falso_cliente <br> **Endpoint destino:** `/api/admin/stats` (Módulo exclusivo de Admin). |
| **Pasos a Ejecutar** | 1. Levantar el servidor e inicializar el contexto de Spring Boot. <br> 2. Enviar una petición HTTP GET al endpoint `/api/admin/stats` incluyendo en la cabecera `Authorization` el token del usuario con rol `"ESTUDIANTE"`. <br> 3. Capturar la respuesta del servidor. |
| **Resultado Esperado** | 1. El servidor rechaza la petición con código de estado HTTP **403 Forbidden**. <br> 2. El cuerpo de la respuesta contiene el JSON: `{"error":"No tienes permisos para esta acción"}`. |
| **Resultado Obtenido** | **Pass** |
| **Evidencia** | Impresión en consola por el test unitario `test4_AccessControl_ClientToAdminRoute`: `✅ ESTADO: [PASÓ] -> Cumple con los requisitos de seguridad. DETALLES: Código devuelto: 403 (Esperado: 403 Forbidden)`. |

---

### Caso de Prueba: TC-SEC-002 (Inyección SQL en Login)

| Campo | Descripción |
| :--- | :--- |
| **ID del Caso** | TC-SEC-002 |
| **Nombre** | Rechazo seguro de payload de Inyección SQL en el campo de entrada de Login. |
| **Requisito Asociado** | OWASP Top 10 - A03: Injection. Asegurar que las consultas a la base de datos utilicen consultas parametrizadas (JPA/Hibernate) y no expongan errores ni salten la autenticación. |
| **Prioridad** | Alta (Crítico). |
| **Precondiciones** | 1. La base de datos está activa y conectada. <br> 2. El endpoint `/api/auth/login` está operativo. |
| **Datos de Prueba** | **Payload Inyección SQL en Email:** `usuario@ejemplo.com' OR '1'='1` <br> **Password:** `cualquiera` |
| **Pasos a Ejecutar** | 1. Enviar una petición HTTP POST a `/api/auth/login`. <br> 2. Insertar el payload de inyección SQL en la clave `"email"`. <br> 3. Capturar el código de respuesta HTTP. |
| **Resultado Esperado** | 1. El servidor devuelve **401 Unauthorized** (o 400/404) indicando credenciales inválidas. <br> 2. El servidor **NO** devuelve 200 OK (lo que indicaría evasión de contraseña). <br> 3. El servidor **NO** devuelve 500 Internal Server Error (lo que indicaría un fallo de sintaxis SQL expuesto). |
| **Resultado Obtenido** | **Pass** |
| **Evidencia** | Impresión en consola por el test `test3_SqlInjectionAttemptInLogin`: `✅ ESTADO: [PASÓ] -> Cumple con los requisitos de seguridad. DETALLES: Código devuelto: 401 (Se esperaba rechazo)`. |

---

### Caso de Prueba: TC-SEC-003 (Acceso sin Token a Endpoints Protegidos)

| Campo | Descripción |
| :--- | :--- |
| **ID del Caso** | TC-SEC-003 |
| **Nombre** | Bloqueo de acceso no autorizado a rutas privadas sin token de sesión. |
| **Requisito Asociado** | OWASP Top 10 - A07: Identification and Authentication Failures. Restringir endpoints sensibles a usuarios no autenticados. |
| **Prioridad** | Alta. |
| **Precondiciones** | 1. El endpoint protegido `/api/auth/me` está registrado en el sistema. |
| **Datos de Prueba** | **Petición sin cabecera de autenticación** (sin token, sin cookies). |
| **Pasos a Ejecutar** | 1. Realizar una petición HTTP GET a `/api/auth/me` sin enviar cabecera `Authorization` ni cookies. <br> 2. Inspeccionar la respuesta HTTP. |
| **Resultado Esperado** | 1. El sistema intercepta la petición y responde inmediatamente con un error **401 Unauthorized**. |
| **Resultado Obtenido** | **Pass** |
| **Evidencia** | Impresión en consola del test `test1_UnauthorizedAccessWithoutToken`: `✅ ESTADO: [PASÓ] -> Cumple con los requisitos de seguridad. DETALLES: Código devuelto: 401`. |

---

### Caso de Prueba: TC-SEC-004 (DAST / Cabeceras de Seguridad)

| Campo | Descripción |
| :--- | :--- |
| **ID del Caso** | TC-SEC-004 |
| **Nombre** | Presencia de cabeceras HTTP de protección (X-Content-Type, X-Frame-Options) validadas por DAST. |
| **Requisito Asociado** | Rúbrica 3: "Reporte de Pruebas Dinámicas (DAST) con OWASP ZAP (Caja Negra) - Mitigación de alertas comunes de cabeceras". |
| **Prioridad** | Media. |
| **Precondiciones** | 1. El filtro `StaticNoCacheFilter` está configurado y activo en el ciclo de vida de la aplicación. |
| **Datos de Prueba** | Petición HTTP estándar a cualquier endpoint de la API. |
| **Pasos a Ejecutar** | 1. Realizar una petición HTTP GET a `/api/admin/stats` o cualquier recurso. <br> 2. Inspeccionar las cabeceras (headers) de respuesta devueltas por el servidor. |
| **Resultado Esperado** | 1. La cabecera `X-Frame-Options` debe tener el valor `DENY`. <br> 2. La cabecera `X-Content-Type-Options` debe tener el valor `nosniff`. |
| **Resultado Obtenido** | **Pass** |
| **Evidencia** | Impresión en consola del test `test5_Dast_SecurityHeadersPresent`: `✅ ESTADO: [PASÓ] -> Cumple con los requisitos de seguridad. DETALLES: X-Frame-Options: DENY \| X-Content-Type-Options: nosniff`. |
