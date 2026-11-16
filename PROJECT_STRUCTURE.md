# Estructura del Proyecto Shidell

```text
shidell-master/
├── pom.xml                        # Configuración principal Maven (Spring Boot 3.3.0, Java 22)
├── package.json                   # Dependencias de assets frontend y script de sincronización de íconos
├── docker-compose.yml             # Stack de monitoreo (Prometheus y Grafana)
├── prometheus.yml                 # Configuración de scraping (/actuator/prometheus)
├── PROJECT_STRUCTURE.md           # Guía actualizada de organización del proyecto
├── docs/                          # Documentación académica, evidencias, gestión y diseños
│   ├── arquitectura/              # Propuestas, SCAMPER y mapas de empatía
│   ├── database/                  # Esquema SQL (schema.sql) y guía BD para IA (BASE_DE_DATOS.md)
│   ├── evidencias/                # Capturas y entregables de pruebas (incluye evidencias/cap4/)
│   ├── figma/                     # Datos exportados de diseño UI/login
│   ├── gestion/                   # EDT y cronogramas del proyecto
│   └── pruebas/                   # Casos de prueba y capítulos III y IV (sostenibilidad, MVP y evidencias)
├── scripts/                       # Utilidades de mantenimiento (sin credenciales fijas)
│   ├── CleanDB.java               # Limpieza de docentes sin cursos asignados (usa DB_PASSWORD)
│   ├── check.js                   # Verificación rápida de usuarios docentes (usa DB_PASSWORD)
│   ├── clean.js                   # Reseteo/poblado auxiliar de esquema (usa DB_PASSWORD)
│   ├── copy_icons.js              # Copia íconos SVG desde node_modules a plataformaestudiante/icons
│   └── wipe.js                    # Limpieza de tabla usuarios para desarrollo (usa DB_PASSWORD)
├── shidell-eureka-server/         # Servidor de descubrimiento Netflix Eureka (puerto 8761)
│   ├── pom.xml
│   └── src/main/java/.../EurekaServerApplication.java
└── src/
    ├── main/
    │   ├── java/org/example/shidell/
    │   │   ├── ShidellApplication.java
    │   │   ├── config/            # AppConfig, AuthInterceptor, CacheConfig (Caffeine), DataSeeder, StaticNoCacheFilter
    │   │   ├── controller/        # Controladores REST desacoplados (@RestController) + CustomErrorController
    │   │   ├── exception/         # Excepciones de dominio y GlobalExceptionHandler (mensajes sin tecnicismos)
    │   │   ├── mapper/            # EntityMapper (conversión entidad <-> DTO)
    │   │   ├── model/             # Entidades JPA (entity/) y DTOs (dto/)
    │   │   ├── repository/        # Repositorios Spring Data JPA
    │   │   ├── service/           # Lógica de negocio (Admin, Auth, Calificaciones, Cursos, Progreso, etc.)
    │   │   └── util/              # AcademicCalendarUtil, AcademicGroupHelper, GradeCalculationHelper, FileUploadUtil, TextUtils
    │   └── resources/
    │       ├── application.properties
    │       └── static/            # Frontend web (landing, auth, error pages y 4 portales por rol)
    │           ├── assets/errors/ # Ilustraciones creativas por portal para páginas 403/404/500 y modales
    │           ├── auth/
    │           ├── css/
    │           ├── error/         # Páginas personalizadas 403.html, 404.html, 500.html y error.html
    │           ├── plataformaadmin/
    │           ├── plataformadocente/
    │           ├── plataformaestudiante/
    │           ├── plataformapadres/
    │           ├── vendor/        # alertas.js, shidell-theme.js (+ ShidellGrades), shidell-ux.js
    │           ├── index.html
    │           ├── login.html
    │           ├── register.html
    │           ├── manifest.json
    │           └── sw.js
    └── test/
        ├── java/org/example/shidell/  # Pruebas unitarias, integración (@WebMvcTest/@DataJpaTest) y seguridad
        └── resources/
            └── application-test.properties
```

## Puertos locales por defecto
- **Eureka Discovery Server (`shidell-eureka-server`)**: `http://localhost:8761`
- **Shidell Application**: `http://localhost:8080`
- **Actuator / Prometheus**: `http://localhost:8080/actuator/health`, `http://localhost:8080/actuator/prometheus`

## Variables de entorno soportadas
- `DB_URL` (por defecto `jdbc:postgresql://localhost:5432/demo1`)
- `DB_USERNAME` (por defecto `postgres`)
- `DB_PASSWORD` (requerida por `scripts/*`; en local Spring usa el valor por defecto configurado en `application.properties`)
- `SHIDELL_SESSION_SECRET` (clave HMAC-SHA256 de firma de tokens de sesión)
