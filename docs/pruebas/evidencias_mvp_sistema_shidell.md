# Evidencias Visuales del Sistema Shidell (MVP)

> [!NOTE]
> Este documento consolida las evidencias visuales y funcionales del sistema **Shidell** implementado en Spring Boot y PostgreSQL, contrastado punto por punto con los requisitos del **Capítulo II (Secciones 2.6.1 y 2.6.2)** del documento de avance del proyecto final.

---

## 1. Mapeo de Vistas del Producto Mínimo Viable (Sección 2.6.1)

A continuación se presentan las capturas reales obtenidas directamente sobre el entorno en ejecución (`http://localhost:8080`), demostrando la resolución de cada uno de los componentes solicitados en el proyecto.

---

### A. Portada de acceso y filtro por rol (`/auth/login.html`)
* **Referencia en Word**: Sección 2.6.1, Ítem 1.
* **Descripción**: Punto de acceso único con validación de credenciales encriptadas y redirección automática según el rol asignado (`ESTUDIANTE`, `DOCENTE`, `PADRE`, `ADMIN`).

![01. Portada de Acceso y Login](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/01_login_acceso.png)

---

### B. Portal del Estudiante y Bandeja de Tareas
* **Referencia en Word**: Sección 2.6.1, Ítem 2 y Sección 2.6.2, Pasos 1 y 2.
* **Descripción**: Vista principal del escolar donde visualiza sus cursos matriculados, actividades con entrega próxima, calendario escolar y resumen de estado de tareas.

![02. Portal de Inicio del Estudiante](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/02_portal_estudiante.png)

![03. Bandeja de Tareas y Deberes](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/03_bandeja_tareas.png)

---

### C. Detalle de Curso con Semanas Lectivas (`cursodetalleestudiante.html?id=2`)
* **Problema Resuelto**: La tarea creada no aparecía en el curso `id=2` (Comunicación) ni en su semana lectiva correspondiente.
* **Solución**:
  - Reasignación de curso a Comunicación en base de datos.
  - Implementación del algoritmo `resolverSemanaDeTarea` de 7 días (lunes a domingo), ubicando la tarea en la **Semana 28**.
  - Acordeón de la semana con actividad se despliega automáticamente.
  - Inclusión de foro semanal activo creado por la docente.

![04. Detalle de Curso Comunicación - Semana 28](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/04_curso_detalle_semana28.png)

---

### D. Rediseño Editorial de Detalle de Tarea y Entrega (`tareadetalle.html`)
* **Referencia en Word**: Sección 2.6.2, Paso 3 (*Paso central: Envío de archivo y generación de constancia*).
* **Diseño UI/UX**:
  - Eliminación del exceso de tarjetas rectangulares y cuadros grises repetitivos.
  - Composición editorial limpia inspirada en Syllabus (Dribbble), tipografía jerárquica y amplios espacios de lectura.
  - Área funcional de carga de archivos (PDF/imagen) con botón de entrega y emisión de comprobante de entrega.

![05. Detalle de Tarea Editorial y Entrega](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/05_tarea_detalle_editorial.png)

---

### E. Cuadro de Calificaciones CNEB (`calificaciones.html`)
* **Referencia en Word**: Sección 2.6.1, Ítem 3.
* **Descripción**: Cuadro integral de notas organizadas por área curricular y competencias del Currículo Nacional (CNEB), con cálculo de rendimiento acumulado y desglose por bimestres.

![06. Calificaciones del Currículo Nacional](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/06_calificaciones_cneb.png)

---

### F. Entorno de Aula Docente (`/plataformadocente/index.html#/mis-clases`)
* **Referencia en Word**: Sección 2.6.1, Ítem 4 y Sección 2.6.2, Paso 4.
* **Descripción**: Panel de trabajo diario del profesor con botones para:
  1. *Estudiantes*: Directorio de matriculados por sección.
  2. *Asistencia*: Marcado masivo de asistencia con un solo clic.
  3. *Foros*: Acceso inmediato a la gestión y apertura de foros de debate.

![07. Panel Docente - Mis Clases](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/07_docente_mis_clases.png)

---

### G. Nuevo Módulo de Creación y Moderación de Foros Docente (`#/foros`)
* **Problema Resuelto**: El docente requería una interfaz para crear, iniciar y moderar los foros de debate semanales.
* **Solución**:
  - Vista integrada en la SPA docente con selector de curso y selector de semanas (1 a 36).
  - Formulario de apertura de foro que habilita de inmediato la participación estudiantil.
  - Feed en vivo con respuestas de alumnos, distintivo oficial de **DOCENTE** y botón de moderación / eliminación.

![08. Gestión y Creación de Foros Docente](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/08_docente_foros_semanales.png)

---

### H. Resumen para Apoderados (`/plataformapadres/html/portalpadres.html`)
* **Referencia en Word**: Sección 2.6.1, Ítem 5 y Sección 2.6.2, Paso 5.
* **Descripción**: Interfaz ligera optimizada para dispositivos móviles donde los padres de familia consultan la asistencia del día de sus hijos, las calificaciones publicadas y alertas tempranas de desempeño sin esperas de fin de bimestre.

![09. Resumen Móvil para Padres de Familia](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/09_portal_padres.png)

---

## 2. Resumen de Flujo Operativo Validado (Sección 2.6.2)

| Paso | Actor | Acción Validada en el Sistema | Evidencia |
| :--- | :--- | :--- | :--- |
| **1** | Estudiante | Login y validación de permisos en base de datos. | `01_login_acceso.png` |
| **2** | Estudiante | Consulta de tareas del día en inicio y bandeja. | `02_portal_estudiante.png`, `03_bandeja_tareas.png` |
| **3** | Estudiante | Navegación a la semana lectiva exacta (Semana 28) y entrega de tarea. | `04_curso_detalle_semana28.png`, `05_tarea_detalle_editorial.png` |
| **4** | Docente | Registro de lista en un clic y publicación/moderación de foros. | `07_docente_mis_clases.png`, `08_docente_foros_semanales.png` |
| **5** | Padre | Verificación de asistencia y calificaciones publicadas desde el móvil. | `09_portal_padres.png`, `06_calificaciones_cneb.png` |
