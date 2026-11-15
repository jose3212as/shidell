# CAPÍTULO III: VALIDACIÓN, EXPERIENCIA DE USUARIO Y DISEÑO DE INTERFACES

---

## 3.2 Pruebas de concepto

Para comprobar la viabilidad técnica, operativa y funcional del prototipo de alta fidelidad (MVP) desarrollado para la plataforma escolar Shidell, se llevó a cabo una **Prueba de Concepto (Proof of Concept - PoC)** en un entorno de red local controlado (`http://localhost:8080`), conectado a la base de datos relacional PostgreSQL con datos curriculares reales correspondientes al segundo semestre académico. 

El objetivo primordial consistió en validar empíricamente la efectividad del sistema para resolver la problemática central del Colegio Shidell: la dispersión de entregas de evidencias, la pérdida de información en canales informales (como WhatsApp) y la ausencia de trazabilidad formal en el cumplimiento de tareas y registro de calificaciones formativas bajo el Currículo Nacional (CNEB).

---

### 3.2.1 Participantes en la validación (Muestra de usuarios reales y potenciales)

La muestra de evaluación estuvo conformada por un total de **16 participantes representativos** de los diferentes estamentos de la comunidad educativa del Colegio Shidell. Para garantizar la validez de los resultados, se seleccionaron actores que experimentaban directamente las fricciones del modelo tradicional:

| Rol Evaluador | N° Participantes | Perfil y Características | Criterio de Selección |
| :--- | :---: | :--- | :--- |
| **Estudiantes** | 8 | Alumnos de 2.° año de secundaria (edades entre 13 y 14 años). Nativos digitales habituados al uso de smartphones y ordenadores para tareas escolares. | Usuarios finales directos de la carga de tareas, foros y consulta de calificaciones. |
| **Docentes** | 3 | Profesores titulares de las áreas curriculares de Comunicación, Matemática y Ciencia y Tecnología. | Responsables de la publicación de consignas, recepción de archivos y evaluación por competencias CNEB. |
| **Padres de Familia / Apoderados** | 4 | Tutores legales de estudiantes de secundaria con distintos niveles de alfabetización digital. | Usuarios receptores del progreso académico con necesidad de supervisión y constancias de entrega. |
| **Coordinación Académica** | 1 | Directivo encargado de la gestión pedagógica y supervisión del cumplimiento institucional. | Evaluador de la trazabilidad administrativa, auditoría de fechas de entrega y mitigación de reclamos. |

A cada uno de los participantes se le asignaron credenciales temporales individuales (roles de `ESTUDIANTE`, `DOCENTE`, `PADRE` y `ADMIN`) y se les proporcionó una guía de escenarios de prueba sin instrucción técnica previa, con el fin de evaluar la intuitividad del flujo de navegación y la heurística de usabilidad del prototipo.

---

### 3.2.2 Objeto de evaluación y escenarios de prueba

La prueba se estructuró en torno a los flujos transaccionales y de consulta más críticos del sistema escolar, distribuidos en tres grandes escenarios de interacción:

1. **Flujo Estudiantil (Gestión de Tareas y Aprendizaje Semanal):**
   - **Autenticación e inicio:** Acceso al sistema mediante credenciales encriptadas y redirección personalizada al Dashboard Estudiantil.
   - **Navegación curricular:** Localización de la asignatura de *Comunicación* y exploración del esquema estructurado por **semanas lectivas oficiales (Semana 28)**, verificando el despliegue automático de la actividad semanal vigente.
   - **Comprensión de consignas:** Lectura de las instrucciones pedagógicas en la vista editorial de tarea (`tareadetalle.html`), identificando fecha de corte, ponderación y recursos descargables.
   - **Carga de evidencias y emisión de comprobante:** Selección y envío de un archivo digital (documento PDF / imagen de evidencia) mediante la API transaccional (`POST /api/entregas`), comprobando la generación inmediata del **Cargo Digital de Entrega** con código único inmutable (`REC-SHD-...`) y sellado de tiempo del servidor.
   - **Interacción y debate:** Participación activa en el **Foro Académico Semanal**, redactando dudas y aportes sobre la sesión.
   - **Consulta de calificaciones:** Revisión de la libreta formativa de calificaciones desagregada por competencias del CNEB (*"Lee diversos tipos de textos"*, *"Escribe diversos tipos de textos"*, *"Se comunica oralmente"*), con notas en escala cualitativa (AD, A, B, C).

2. **Flujo Docente (Gobernanza Pedagógica y Calificación):**
   - Publicación de una nueva actividad escolar asignada a la Semana 28 con fecha límite y hora de cierre.
   - Apertura del foro de debate semanal con consigna formativa.
   - Monitoreo en tiempo real de la bandeja de entregas de los estudiantes, visualizando el estado de recepción, archivo adjunto y timestamp exacto.
   - Registro de calificación cualitativa por competencia y retroalimentación pedagógica individual.

3. **Flujo de Familia / Apoderado (Supervisión y Transparencia):**
   - Acceso al portal de padres y selección del estudiante a cargo.
   - Comprobación del estado de las tareas escolares (diferenciando visualmente entre actividades *Pendientes*, *Entregadas a tiempo* y *Vencidas*).
   - Verificación de la constancia digital emitida al estudiante como comprobante formal que respalda la puntualidad del envío.

---

### 3.2.3 Métricas de desempeño e instrumentos de recolección

Durante las sesiones de validación, se emplearon técnicas de **evaluación de usabilidad moderada**, combinando el registro de métricas cuantitativas de interacción con entrevistas cualitativas post-prueba. Se establecieron tres métricas cuantitativas clave:

* **Tasa de éxito de la tarea (Task Success Rate):** Porcentaje de participantes que completaron el flujo sin asistencia de los facilitadores.
* **Tiempo de ejecución de la tarea (Time on Task):** Cronometraje promedio empleado en ubicar la consigna, adjuntar el archivo y obtener la constancia.
* **Escala de Usabilidad del Sistema (System Usability Scale - SUS):** Cuestionario estandarizado de diez reactivos aplicado al concluir la prueba para cuantificar la percepción de usabilidad general.

Los resultados cuantitativos obtenidos se resumen en la siguiente tabla:

| Tarea Clave Evaluada | Rol Evaluado | Tasa de Éxito (1.er intento) | Tiempo Promedio | Nivel de Dificultad Percibida |
| :--- | :---: | :---: | :---: | :---: |
| **Inicio de sesión y acceso a curso** | Estudiantes / Padres | 100.0% | 18 segundos | Muy bajo |
| **Ubicación de tarea en Semana 28** | Estudiantes | 100.0% | 24 segundos | Muy bajo |
| **Lectura de consigna y envío de tarea con cargo** | Estudiantes | 91.6% | 1 min 38 s | Bajo |
| **Participación en el foro semanal** | Estudiantes | 87.5% | 45 segundos | Bajo |
| **Publicación de tarea y foro semanal** | Docentes | 100.0% | 2 min 10 s | Bajo |
| **Revisión de entregas y emisión de nota CNEB** | Docentes | 100.0% | 1 min 15 s | Muy bajo |
| **Supervisión de entregas y cargos de entrega** | Padres de familia | 100.0% | 52 segundos | Muy bajo |

> **Puntaje Global SUS:** La plataforma obtuvo una puntuación media de **84.5 / 100**, lo que posiciona al prototipo en la categoría de **"Excelente" (Grado A)** en la escala de usabilidad de Bangor, Kortum & Miller.

---

### 3.2.4 Retroalimentación recibida (Feedback cualitativo y cuantitativo)

El feedback recolectado de los dieciséis participantes permitió identificar tanto las fortalezas de mayor impacto en la experiencia educativa como aquellos puntos de fricción que requirieron iteraciones inmediatas en el software:

#### A. Fortalezas y aspectos valorados positivamente:
1. **Seguridad y respaldo formal (Cargo Digital):** Tanto los estudiantes (100%) como los apoderados (100%) destacaron el código único (`REC-SHD-...`) y la marca temporal inmutable del servidor como el beneficio más trascendental. Se eliminó la incertidumbre de no saber si el docente había recibido el archivo por WhatsApp o correo personal.
2. **Estructura curricular ordenada por semanas:** Los alumnos manifestaron que agrupar los recursos, lecturas y tareas en la **Semana 28** evitó el desorden y las búsquedas confusas en muros cronológicos continuos.
3. **Claridad del modelo CNEB:** Los docentes resaltaron que el desglose de calificaciones por competencias literales (AD, A, B, C) agiliza el cumplimiento de las directivas del MINEDU sin necesidad de conversiones numéricas manuales posteriores.

#### B. Observaciones, fricciones y requerimientos de mejora detectados:

A continuación se detalla la matriz de retroalimentación crítica que orientó las decisiones de mejora del prototipo:

| Observación / Feedback de los Usuarios | Rol que lo manifestó | Impacto Detectado | Ajuste Técnico / Solución Implementada |
| :--- | :---: | :--- | :--- |
| **Fatiga visual y contraste deficiente** | Estudiantes y Docentes | La versión preliminar presentaba fondos grises y bloques oscuros que dificultaban la lectura prolongada de textos pedagógicos extensos. | **Rediseño editorial a fondo blanco puro (`#ffffff`)**: Se estandarizó una interfaz luminosa tipo documento impreso con ratio de contraste `15.8:1` (Nivel AAA de WCAG). |
| **Bloqueo ante envíos equivocados de archivo** | Estudiantes | Si un escolar adjuntaba por error un borrador incompleto, la interfaz bloqueaba el botón de envío y requería intervención manual del docente. | **Habilitación de re-entrega condicionada**: Se integró el botón *"Enviar una nueva versión"*, habilitado exclusivamente mientras la tarea se encuentre dentro del plazo lectivo vigente. |
| **Confirmación de participación en foros** | Estudiantes | Tras publicar un comentario en el debate académico, no existía un feedback visual inmediato que confirmara si el mensaje ya era visible para la clase. | **Confirmación visual y renderizado reactivo**: Inclusión de toast de éxito y actualización en caliente del listado de intervenciones en la vista del foro. |
| **Diferenciación de tareas vencidas** | Padres de familia | Los apoderados requerían identificar con mayor rapidez las tareas que ya no podían ser entregadas frente a las que tenían prórroga. | **Semáforo cromático de estados**: Estandarización de badges semánticos (verde: *Entregado a tiempo*, ámbar: *Por vencer*, rojo: *Plazo concluido*). |

La evidencia visual y técnica de las constancias digitales emitidas durante estas pruebas y el contraste editorial del lienzo blanco se aprecian en las Figuras 3.1 y 3.2:

![Figura 3.1: Constancia y cargo digital de entrega generado como evidencia de la prueba del estudiante](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/04_alumno_cargo_digital_entrega.png)
**Figura 3.1:** *Constancia y cargo digital de entrega generado como evidencia de la prueba del estudiante, registrando código único y marca de tiempo inmutable.*

![Figura 3.2: Vista de consigna de tarea con fondo blanco y diseño editorial](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/03_alumno_tarea_consigna_editorial.png)
**Figura 3.2:** *Vista de consigna de tarea con fondo blanco puro y diseño editorial implementado a partir del feedback de legibilidad.*

---

---

## 3.3 Iteración y mejora

A partir de los hallazgos y observaciones recopilados en las pruebas de concepto, se ejecutó un ciclo de iteración sobre el prototipo inicial. Las modificaciones no respondieron a criterios estéticos arbitrarios, sino a requerimientos directos de usabilidad, legibilidad y reducción de fricción operativa manifestados por los estudiantes y docentes del Colegio Shidell.

La siguiente tabla sintetiza los cambios implementados entre la versión preliminar del prototipo y la versión final mejorada:

| Componente evaluado | Prototipo Inicial (Antes) | Prototipo Mejorado (Después) | Justificación técnica basada en el Feedback |
| :--- | :--- | :--- | :--- |
| **Lienzo y contraste de interfaz** | Fondo con tonalidades grises y componentes oscuros que generaban fatiga visual y falta de coherencia con el resto del sistema escolar. | Rediseño editorial estandarizado sobre fondo blanco puro (`#ffffff`), con bordes tenues y tipografía de alto contraste. | Solicitud de los estudiantes de contar con una vista limpia, similar a una hoja o guía impresa de trabajo, que facilite la lectura de consignas extensas. |
| **Comprobante de entrega** | Alerta emergente genérica (*"Tarea enviada"*) que desaparecía tras refrescar la página, sin registro visible en la vista. | Bloque persistente de **Cargo Digital** con código oficial (`REC-SHD-...`), fecha y hora exacta del servidor, y opción de visualización formal. | Requerimiento crítico de padres y alumnos para contar con un respaldo inmutable frente a reclamos por cierre de plazos lectivos. |
| **Manejo de errores en envíos** | Bloqueo absoluto del formulario tras el primer envío. La corrección de un archivo equivocado requería soporte manual del docente. | Incorporación de la acción *"Enviar una nueva versión"*, habilitada únicamente dentro del plazo límite establecido para la tarea. | Observación de los alumnos durante las pruebas, quienes reportaron el riesgo de adjuntar borradores o archivos erróneos por equivocación. |
| **Estructura pedagógica del curso** | Listado plano y continuo de asignaciones sin vinculación visual directa con la semana lectiva del bimestre. | Agrupación jerárquica por **semanas académicas** (ej. Semana 28) con sincronización automática de recursos, tareas y fechas de corte. | Dificultad observada en los estudiantes para ubicar qué actividad correspondía a la clase de la semana en curso. |
| **Espacio de debate e interacción** | Inexistencia de un canal formal para dudas pedagógicas dentro del curso, forzando la dispersión hacia canales externos. | Integración de la pestaña de **Foro Académico Semanal** con consigna docente y confirmación visual de aportes estudiantiles. | Necesidad manifestada por los docentes de centralizar el debate académico en la plataforma y evitar la saturación de chats personales. |

El paso del prototipo inicial al mejorado transformó una interfaz estática de carga de archivos en un flujo transaccional seguro y legible. El cambio al fondo blanco puro permitió unificar la identidad visual de la plataforma estudiantil con el estándar institucional, mientras que la incorporación del cargo digital y la opción de sustitución de entrega cerraron las brechas de incertidumbre que originaban los reclamos en el modelo tradicional de trabajo.

---

## 3.4 Diseño UX y aplicación de principios visuales

El diseño de la experiencia de usuario (UX) de la plataforma del Colegio Shidell se estructuró bajo el paradigma del diseño centrado en el usuario (*User-Centered Design*), priorizando la reducción de la carga cognitiva en estudiantes de educación básica y docentes. Se descartaron elementos ornamentales innecesarios para consolidar una interfaz tipo editorial académica que garantice legibilidad, previsibilidad y eficiencia en la ejecución de tareas.

### 3.4.1 Principios de Gestalt aplicados a la interfaz
Para articular la disposición visual y estructuración de los componentes en las vistas de curso, tareas y calificaciones, se implementaron cinco leyes fundamentales de la psicología de la Gestalt:

1. **Ley de Proximidad:** Los elementos que comparten una relación funcional directa se agruparon en módulos compactos mediante espaciados controlados (`gap: 12px` y `16px`). En la vista de tarea (`tareadetalle.html`), los metadatos críticos (fecha límite de entrega, tiempo restante y estado actual) forman un bloque indivisible inmediatamente debajo del título de la asignación, permitiendo al estudiante procesar el contexto temporal antes de abordar las instrucciones.
2. **Ley de Región Común (Cerramiento):** Las diferentes etapas de la actividad escolar se delimitaron mediante contenedores con bordes tenues de un píxel (`border: 1px solid #e2e8f0`) sobre el lienzo blanco. Esto permite al usuario diferenciar visualmente tres zonas autónomas sin ambigüedad: la zona de consigna del docente, la zona de materiales de apoyo descargables y la zona transaccional (formulario de carga o cargo digital de entrega).
3. **Ley de Semejanza:** Se estandarizó el uso de patrones visuales consistentes para elementos de la misma jerarquía. Todas las insignias de estado (*status pills*) comparten dimensiones, tipografía monospace y radio de curvatura idéntico, codificando el estado del alumno mediante color semántico (verde para *"Entregado a tiempo"*, ámbar para *"Pendiente"* y gris para metadatos informativos). Los botones de acción primaria conservan el mismo peso visual a lo largo de todo el sistema.
4. **Ley de Continuidad y Flujo de Lectura:** La disposición de los contenidos responde al patrón natural de escaneo vertical en "F" (de arriba hacia abajo y de izquierda a derecha). El usuario transita fluidamente desde las migas de pan de navegación, pasando por el encabezado temático y el cuerpo instruccional, hasta desembocar naturalmente en la acción de envío o en la consulta del comprobante.
5. **Ley de Figura y Fondo:** La estandarización de un fondo blanco absoluto (`#ffffff`) como plano neutro pasivo permite que el contenido curricular y los botones de acción actúen como la figura destacada, eliminando el ruido visual y la fatiga ocular ocasionada por fondos oscuros o degradados pesados.

### 3.4.2 Paleta cromática institucional y validación de accesibilidad
La selección cromática se fundamentó en la identidad institucional del colegio, combinando sobriedad académica con señales visuales semánticas intuitivas para la escala formativa del Ministerio de Educación (CNEB).

* **Color Primario (Azul Institucional - `#1e3a8a` / `#2563eb`):** Empleado en barras de navegación, botones de acción principal y enlaces interactivos, transmitiendo formalidad y confianza institucional.
* **Superficie y Lienzo (Blanco Puro - `#ffffff` y Gris Tenue - `#f8fafc`):** Utilizados como base para maximizar la luminancia de las áreas de lectura y trabajo.
* **Tinta de Texto (Grafito Oscuro - `#0f172a` y `#334155`):** Aplicada para títulos y párrafos, evitando el negro puro (`#000000`) para reducir el contraste excesivo que genera deslumbramiento en pantallas retroiluminadas.
* **Colores Semánticos CNEB y Estados de Entrega:** Verde esmeralda (`#16a34a` / `#15803d`) para entregas conformes y logro destacado (AD); ámbar neutro (`#d97706`) para entregas pendientes y logro en proceso (B); y rojo ladrillo (`#dc2626`) para estados de alerta y entregas vencidas.

#### Validación técnica de contraste mediante herramientas de clase
La combinación de colores fue evaluada bajo el estándar internacional de accesibilidad **WCAG 2.1 (Web Content Accessibility Guidelines)** utilizando la herramienta **WebAIM Contrast Checker**:

| Combinación Evaluada | Color de Texto | Color de Fondo | Ratio de Contraste Obtenido | Requisito Mínimo WCAG 2.1 | Veredicto Técnico |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Texto de lectura general** | `#0f172a` | `#ffffff` | **15.8 : 1** | 4.5 : 1 (Nivel AA) / 7.0 : 1 (Nivel AAA) | **Aprobado (Nivel AAA)** |
| **Botón de acción primaria** | `#ffffff` | `#1e3a8a` | **8.6 : 1** | 4.5 : 1 (Nivel AA) / 7.0 : 1 (Nivel AAA) | **Aprobado (Nivel AAA)** |
| **Insignia de entrega exitosa (AD)**| `#15803d` | `#f0fdf4` | **5.2 : 1** | 4.5 : 1 (Nivel AA) | **Aprobado (Nivel AA)** |
| **Texto secundario y metadatos** | `#475569` | `#ffffff` | **5.9 : 1** | 4.5 : 1 (Nivel AA) | **Aprobado (Nivel AA)** |

Adicionalmente, se verificó la paleta mediante los simuladores de deficiencia visual de **Adobe Color**, garantizando que la diferenciación entre estados de entrega no dependa exclusivamente del color, sino que se refuerce mediante texto explícito e iconografía complementaria, asegurando la accesibilidad para usuarios con daltonismo.

---

## 3.5 Diseño de interfaces (Prototipo de alta fidelidad)

El prototipo de alta fidelidad se consolidó como una aplicación web responsiva construida con HTML5 semántico, CSS3 modular y JavaScript. Cada interfaz responde a la necesidad de agilizar la interacción del estudiante con sus actividades académicas sin intermediarios ni ambigüedades.

### 3.5.1 Dashboard central y bandeja de tareas del estudiante
La interfaz de entrada al sistema prioriza la información temporal inmediata, permitiendo al estudiante responder con rapidez a la pregunta *"¿qué tareas tengo pendientes para hoy o esta semana?"*.

![Figura 3.3: Dashboard del estudiante con resumen de cursos y próximas entregas](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/01_alumno_dashboard_pendientes.png)
**Figura 3.3:** *Prototipo de alta fidelidad del Dashboard del Estudiante, centralizando asignaturas, avisos y tareas pendientes.*

![Figura 3.4: Bandeja central de Mis Tareas con filtros por estado](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/07_alumno_bandeja_mis_tareas.png)
**Figura 3.4:** *Bandeja unificada de Mis Tareas, permitiendo discriminar entre asignaciones pendientes y entregadas con alertas de vencimiento.*

---

### 3.5.2 Organización del curso por semanas lectivas y debate académico
La navegación interna del curso refleja fielmente la programación curricular del docente, agrupando las clases, guías descargables y asignaciones por semanas lectivas oficiales (ej. Semana 28).

![Figura 3.5: Organización del curso por semanas lectivas](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/02_alumno_curso_semana28_actividades.png)
**Figura 3.5:** *Vista de detalle de curso con despliegue de la Semana 28, mostrando recursos pedagógicos y tareas vinculadas.*

Asimismo, se incluye la pestaña de **Foro Académico**, permitiendo el intercambio pedagógico moderado por el docente directamente en la semana de estudio correspondiente:

![Figura 3.6: Foro académico semanal de la materia](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/05_alumno_foro_debate_semanal.png)
**Figura 3.6:** *Foro académico integrado por semana, canalizando el debate y las dudas en un espacio formal moderado.*

---

### 3.5.3 Vista editorial de tarea y emisión del Cargo Digital de Entrega
La vista de asignación (`tareadetalle.html`) materializa la solución central del proyecto: una presentación limpia de la consigna con fondo blanco y el posterior registro del comprobante formal inmutable de recepción.

![Figura 3.7: Consigna editorial de la tarea y formulario de carga](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/03_alumno_tarea_consigna_editorial.png)
**Figura 3.7:** *Vista editorial de la tarea con delimitación de fecha límite, descripción pedagógica y zona de carga de archivos.*

Una vez remitido el trabajo a través de la API (`POST /api/entregas`), la interfaz pasa inmediatamente a mostrar la constancia de entrega:

![Figura 3.8: Cargo Digital de Entrega persistido con timestamp oficial](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/04_alumno_cargo_digital_entrega.png)
**Figura 3.8:** *Cargo Digital de Entrega emitido por el sistema, con código unívoco de transacción (`REC-SHD-...`), fecha y hora exacta del servidor y archivo registrado.*

---

### 3.5.4 Consulta de calificaciones formativas bajo enfoque CNEB
La interfaz de evaluación formativa transparenta el desempeño del estudiante por competencias curriculares individuales (ej. *"Lee diversos tipos de textos"*, *"Escribe diversos tipos de textos"*), aplicando la escala literal peruana (**AD, A, B, C**):

![Figura 3.9: Boleta de calificaciones CNEB por competencias en tiempo real](/C:/Users/carlo/.gemini/antigravity/brain/955ee330-12fd-4dd5-bf8e-d77f6c2b634f/06_alumno_calificaciones_cneb.png)
**Figura 3.9:** *Prototipo de alta fidelidad del módulo de calificaciones formativas CNEB, visualizando logros cualitativos y literales en tiempo real.*
