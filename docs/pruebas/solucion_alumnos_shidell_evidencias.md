# Evidencias del Sistema: Solución para los Alumnos (Colegio Shidell)

> [!NOTE]
> Este documento consolida las evidencias visuales y técnicas de la **Solución para los Estudiantes**, contrastadas directamente contra los requerimientos planteados en el informe del proyecto (**Word: Secciones 1.3, 2.1.1 y 2.6.2**).
> Todas las capturas fueron tomadas en tiempo real en la plataforma activa `http://localhost:8080/plataformaestudiante/html/`.

---

## 1. Mapeo entre los Dolores del Alumno y la Solución Implementada

| Requerimiento / Dolor del Alumno (Word §1.3 y §2.1.1) | Problema Previo (WhatsApp / Manual) | Solución Funcional en Plataforma Shidell | Captura de Evidencia |
| :--- | :--- | :--- | :--- |
| **Fechas y materiales en un solo lugar** | Archivos dispersos en chats de WhatsApp, fotos borrosas, pérdida de consignas. | Portal centralizado y cursos estructurados por **semanas lectivas** con materiales adjuntos y fechas límite visibles. | `01_alumno_dashboard_pendientes.png` y `02_alumno_curso_semana28_actividades.png` |
| **Claridad en la consigna de trabajo** | Textos informales y fragmentados en mensajería móvil sin rúbrica clara. | Vista editorial con título, fecha exacta de entrega, descripción detallada y recursos descargables. | `03_alumno_tarea_consigna_editorial.png` |
| **Cargo digital / Constancia de entrega** *(Paso Clave del MVP)* | Sin comprobante. Docentes afirmaban no haber recibido el trabajo; reclamos sin sustento. | **Constancia y Cargo Digital** con código único (`REC-SHD-...`), fecha y hora exacta de recepción, y archivo registrado. | `04_alumno_cargo_digital_entrega.png` |
| **Foros académicos organizados** | Dudas mezcladas con conversaciones informales en grupos de chat. | Espacio de **Foro Académico Semanal** con consigna detonante de la docente y respuestas argumentadas. | `05_alumno_foro_debate_semanal.png` |
| **Consulta directa de notas CNEB** | Los alumnos esperaban hasta fin de bimestre para conocer su calificación literal. | Módulo de **Calificaciones CNEB** en tiempo real por competencias (**AD, A, B, C**). | `06_alumno_calificaciones_cneb.png` |
| **Gestión y control de entregas** | Desorganización al no saber qué tareas faltan entregar. | Bandeja central de **Mis Tareas** con filtro por estado (*Por entregar* / *Entregadas*). | `07_alumno_bandeja_mis_tareas.png` |

---

## 2. Galería de Evidencias de la Solución del Estudiante

### Evidencia 1: Portal y Dashboard del Alumno (Fechas y pendientes en un solo lugar)
*Word §2.1.1.A - Functional Job #1: Acceso inmediato a todas las asignaturas y alertas de vencimiento.*

El estudiante ingresa a su entorno oficial donde visualiza sus asignaturas matriculadas, el estado de sus pendientes y accesos directos inmediatos, eliminando la dependencia de chats grupales.

![Dashboard del Alumno](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/01_alumno_dashboard_pendientes.png)

---

### Evidencia 2: Organización del Curso por Semanas Lectivas (Semana 28)
*Word §2.1.1.A & §2.6.2: Estructura pedagógica clara con actividades y recursos asociados a la semana escolar.*

Al entrar al curso (ej. Comunicación), los contenidos no están desordenados; se presentan jerárquicamente por semanas del año académico. La **Semana 28** expone sus guías pedagógicas y las actividades asignadas.

![Semana 28 del Curso](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/02_alumno_curso_semana28_actividades.png)

---

### Evidencia 3: Consigna Editorial de Tarea e Instrucciones Claras
*Word §2.6.2 Paso 2: Lectura de consigna y preparación de la entrega.*

Diseño con fondo blanco editorial que resalta la fecha y hora de vencimiento, la descripción de la tarea y la zona de carga de archivos (PDF, DOCX, imágenes).

![Consigna Editorial de Tarea](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/03_alumno_tarea_consigna_editorial.png)

---

### Evidencia 4: Constancia y Cargo Digital de Entrega *(Requerimiento Central)*
*Word §2.1.1.A - Job: "Cargo digital por cada entrega" & §2.6.2 Paso 3: Confirmación de recepción.*

> [!IMPORTANT]
> **Respaldo ante reclamos:** Genera automáticamente la constancia **"Entrega Recibida Conforme"**, registrando:
> - **Código único de recibo:** Ej. `REC-SHD-2026-0040`
> - **Fecha y hora exacta de registro:** Timestamp inmutable del servidor.
> - **Archivo adjunto registrado:** Enlace de descarga y verificación.
> - **Botón de Comprobante Oficial:** Opción de visualización formal.

![Cargo Digital de Entrega](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/04_alumno_cargo_digital_entrega.png)

---

### Evidencia 5: Foro Académico Semanal (Debate pedagógico ordenado)
*Word §2.1.1 & §2.6.2: Espacio oficial de debate escolar.*

Reemplaza los hilos confusos de mensajería instantánea por un foro moderado por el docente en la Semana 28, donde el alumno visualiza la pregunta orientadora y publica su respuesta académica.

![Foro Académico Semanal](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/05_alumno_foro_debate_semanal.png)

---

### Evidencia 6: Boleta de Calificaciones CNEB en Tiempo Real
*Word §2.1.1.A - Job: "Consulta directa de notas CNEB".*

El estudiante y sus tutores pueden consultar el avance formativo en la escala literal oficial del Currículo Nacional peruano (**AD: Logro Destacado, A: Logro Esperado, B: En Proceso, C: En Inicio**), con retroalimentación cualitativa por competencia.

![Calificaciones CNEB](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/06_alumno_calificaciones_cneb.png)

---

### Evidencia 7: Bandeja de Tareas con Control de Estado
*Word §2.1.1: Seguimiento de deberes escolares sin riesgo de olvido.*

El estudiante dispone de una bandeja unificada donde filtra sus tareas pendientes y entregadas, con etiquetas visuales de urgencia y fecha límite.

![Bandeja de Tareas](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/07_alumno_bandeja_mis_tareas.png)

---

## 3. Resumen de Ubicación de Archivos en tu Proyecto

Todas las imágenes en alta resolución fueron guardadas tanto en la plataforma como en tu carpeta de proyecto:

- **Carpeta del proyecto:** `evidencias_alumnos/`
  - `01_alumno_dashboard_pendientes.png`
  - `02_alumno_curso_semana28_actividades.png`
  - `03_alumno_tarea_consigna_editorial.png`
  - `04_alumno_cargo_digital_entrega.png`
  - `05_alumno_foro_debate_semanal.png`
  - `06_alumno_calificaciones_cneb.png`
  - `07_alumno_bandeja_mis_tareas.png`
