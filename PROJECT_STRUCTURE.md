# Shidell project structure

This project is organized by responsibility:

- `src/main/java/org/example/shidell`: Spring Boot application code.
- `src/main/java/org/example/shidell/config`: application configuration and initial data loading.
- `src/main/java/org/example/shidell/controller`: REST API controllers.
- `src/main/java/org/example/shidell/diagnostics`: startup diagnostics and inspection helpers.
- `src/main/java/org/example/shidell/model`: JPA entities.
- `src/main/java/org/example/shidell/repository`: Spring Data repositories.
- `src/main/java/org/example/shidell/service`: business logic and session helpers.
- `src/main/java/org/example/shidell/tools`: manual utilities, not part of the web flow.
- `src/main/resources/static/auth`: login and registration pages.
- `src/main/resources/static/plataformaestudiante`: student portal pages and assets.
- `src/main/resources/static/plataformadocente`: teacher portal pages and assets.
- `src/main/resources/static/plataformapadres`: parent portal pages and assets.
- `src/main/resources/static/plataformaadmin`: admin portal pages and assets.
- `src/main/resources/static/vendor`: third-party browser libraries.
- `uploads`: files uploaded by users while the app is running.

Compatibility notes:

- `/login.html` redirects to `/auth/login.html`.
- `/register.html` redirects to `/auth/register.html`.
