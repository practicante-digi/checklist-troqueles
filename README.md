# Sistema de Mantenimiento - Control de Troqueles

## Fase 1: Guía de Usuario (El "Qué")

### 1. ¿Qué problema resuelve el proyecto?
Este proyecto es una plataforma web diseñada para digitalizar y controlar el proceso de mantenimiento de troqueles (herramientas/moldes de producción). Resuelve el problema de llevar un registro manual o desorganizado de los mantenimientos, permitiendo asignar técnicos específicos a cada troquel, medir el tiempo exacto invertido (mediante un cronómetro integrado) y asegurar que se cumplan todas las actividades requeridas a través de un checklist estructurado.

### 2. Layout General y Navegación
La aplicación consta de un encabezado (Header) persistente y una navegación basada en cuatro pestañas principales:

*   **Formulario:** Es el área de trabajo principal. Aquí se selecciona el troquel y el técnico, se inicia el temporizador y se despliega el checklist interactivo agrupado por secciones (acordeones).
*   **Monitor (Dashboard):** Una vista de supervisión en tiempo real. Muestra gráficos del estado actual de los troqueles y tarjetas detalladas con información de producción.
*   **Historial:** Una tabla de registros de mantenimientos pasados. Permite aplicar filtros avanzados (por Troquel, Técnico y Rango de Fechas) y ver detalles específicos de cada sesión.
*   **Códigos QR:** Un gestor para buscar, visualizar, imprimir y descargar códigos QR asociados a cada troquel, facilitando su identificación física en planta.

Durante un mantenimiento activo, el Header cambia dinámicamente para mostrar el troquel en curso, el técnico asignado y un cronómetro visible en todo momento, además de un botón rápido para cancelar la operación.

### 3. Explicación de los KPIs o Métricas Principales
Las métricas operativas se concentran en la pestaña **Monitor**. El sistema rastrea el "Estado de Troqueles" mediante un gráfico interactivo y tarjetas de enfoque (Focus Cards) que detallan:
*   **Número de parte (Material):** Identificador del material o pieza que el troquel está procesando.
*   **Producidas:** Cantidad de piezas ya fabricadas.
*   **Por producir:** Cantidad restante para cumplir la cuota o lote.
*   **Tiempo de ciclo / Status:** El estado operativo del troquel visualizado mediante alertas de color e íconos.

En el **Historial**, la métrica principal es el **Tiempo Invertido (Duración)** por cada mantenimiento, fundamental para analizar la eficiencia técnica.

### 4. Casos de Uso del Día a Día (Operación)
*   **Inicio Rápido por QR:** Un técnico escanea el QR pegado físicamente en el troquel. El sistema abre la web, auto-selecciona el troquel y solo requiere que el técnico elija su nombre para darle a "Iniciar Mantenimiento".
*   **Ejecución del Mantenimiento:** Una vez iniciado, el técnico sigue el checklist (acordeones). Marca casillas de "Completado" y puede añadir comentarios en campos de texto si detecta anomalías.
*   **Finalización Segura:** Al terminar, el técnico presiona "Finalizar". El sistema despliega un modal resumiendo el tiempo total invertido y las secciones completadas antes de sincronizar con la base de datos.
*   **Supervisión de Planta:** El supervisor abre la pestaña **Monitor** en una pantalla para vigilar qué troqueles están en riesgo de parar o cuántas piezas faltan por producir.

### 5. Señales de Alerta Visuales y Limitaciones Actuales
**Alertas Visuales:**
*   **Notificaciones (Toasts):** Mensajes emergentes en la esquina para confirmar éxitos (ej. "¡Mantenimiento Iniciado!") o advertir errores ("No se pudo finalizar").
*   **Validación de Inicio:** Mensaje de advertencia dinámico ("⚠ Falta seleccionar el Técnico") que bloquea el botón de inicio hasta cumplir los requisitos.
*   **Modales de Confirmación Peligrosa:** Al intentar "Cancelar" un mantenimiento en curso, la pantalla se oscurece y un modal rojo advierte que se perderá el progreso (acción destructiva).

**Limitaciones Conocidas (por reglas de negocio):**
*   **Bloqueo de Selectores:** Una vez iniciado el cronómetro, no se puede cambiar de troquel ni de técnico sin cancelar primero todo el proceso.
*   **Requisito de Finalización:** El botón "Finalizar Mantenimiento" permanece deshabilitado hasta que al menos *una* actividad del checklist sea marcada como completada.
*   **Persistencia Local:** Si un técnico cierra la pestaña por accidente o recarga la página durante un mantenimiento, los datos se guardan temporalmente en el navegador (`localStorage`) para que al reabrir la página se restaure el cronómetro y el checklist exactamente donde se quedó.

## Fase 2: Arquitectura y Stack (El "Cómo" a alto nivel)

### 1. Stack Tecnológico Exacto
El proyecto está construido bajo una arquitectura cliente-servidor, utilizando las siguientes tecnologías y versiones clave:

*   **Frontend (Cliente):**
    *   **Lenguaje:** Vanilla JavaScript (ES Modules).
    *   **Estilos:** Tailwind CSS (v3.4.18) compilado (`npx tailwindcss`), con CSS puro de apoyo.
    *   **Librerías Clave:** 
        *   `Choices.js`: Para los selectores amigables de búsqueda (Troqueles y Técnicos).
        *   `Flatpickr`: Para la selección de rangos de fechas en el historial.
        *   `ECharts.js` (v5.5.0): Para el renderizado de gráficos dinámicos en el Monitor.
        *   `JSZip` (v3.10.1): Para comprimir y descargar los códigos QR masivamente.
*   **Backend (Servidor):**
    *   **Entorno:** Node.js (con bandera "type": "module").
    *   **Framework:** Express.js (v5.1.0).
    *   **Base de Datos:** SQL Server, operado a través del paquete `mssql` (v12.1.0).
    *   **Seguridad y Logs:** `helmet` (v8.1.0) para cabeceras HTTP de seguridad, `cors` para políticas de origen cruzado, y `winston` (v3.18.3) con `winston-daily-rotate-file` para logs de servidor rotativos.
    *   **Utilidades:** `qrcode` para generación en el backend de las imágenes de códigos QR.

### 2. Patrón de Arquitectura
El sistema implementa un patrón **Monolítico con API REST** (el backend sirve tanto los estáticos de UI como los endpoints de datos) y sigue una **Arquitectura de Capas** en el backend para una separación clara de responsabilidades:
*   **Capa de Presentación / Cliente:** HTML servido por Express (`app.use(express.static)`), interactuando de forma asíncrona mediante la Fetch API nativa.
*   **Capa de Rutas (Routes):** En el backend, mapea los endpoints HTTP (ej. `/api/mantenimiento`) a sus respectivos controladores.
*   **Capa de Controladores (Controllers):** Maneja la lógica HTTP, valida los datos de entrada del *Request* y formatea el JSON de salida del *Response*. Se conecta directamente a la BD ejecutando los queries en esta capa.

### 3. Estructura de Carpetas Principal
El código base está dividido en dos dominios fundamentales:

```text
Forms-Mantenimiento/
├── client/                     # Código del Frontend (UI)
│   ├── assets/                 # Imágenes, íconos y recursos estáticos
│   ├── css/                    # Archivos fuente (input.css) y compilados (output.css) de Tailwind
│   ├── js/
│   │   ├── api/                # Envoltorios para llamadas fetch (api.js) a los endpoints del servidor
│   │   ├── components/         # Lógica modular UI (header.js, modal.js, timer.js, accordion.js)
│   │   ├── core/               # Manejo del estado (state.js) y funciones UI globales utilitarias
│   │   └── pages/              # Scripts específicos por pestaña (monitor.js, historial.js, qr-manager.js)
│   ├── index.html              # Vista principal de la aplicación (SPA simulada mediante tabs)
│   └── main.js                 # Punto de entrada de JS, inicialización y eventos de navegación
│
└── back/                       # Código del Backend (API REST)
    ├── config/                 # Conexiones a BD (db.js) y configuraciones globales (logger.js)
    ├── controllers/            # Controladores que resuelven las rutas HTTP y queries SQL
    ├── middlewares/            # Interceptores (ej. rate limit, protecciones genéricas)
    ├── routes/                 # Definición y registro de endpoints en Express
    ├── logs/                   # Archivos de texto generados por Winston diariamente
    ├── server.js               # Punto de entrada de Node.js y montaje de Express
    └── cert.pem / key.pem      # Certificados SSL para servir sobre HTTPS localmente
```

### 4. Flujo de Datos General (Ejemplo de Inserción)
Para entender cómo viaja la información, este es el recorrido cuando un usuario "Inicia un Mantenimiento":

1.  **Interacción (Cliente):** El usuario presiona el botón "Iniciar Mantenimiento" en el formulario HTML (`main.js`).
2.  **Capa API (Cliente):** `main.js` invoca a la función `apiIniciarMantenimiento` dentro de `client/js/api/api.js`.
3.  **Petición HTTP:** El navegador envía un `POST` asíncrono con `idTroquel` e `idUsuario` hacia la ruta `https://[host]/api/mantenimiento/iniciar`.
4.  **Enrutamiento (Servidor):** Express intercepta la petición en `server.js` y la delega a `back/routes/mantenimiento.routes.js`.
5.  **Controlador y Persistencia (Servidor):** El archivo `mantenimiento.controller.js` recibe el cuerpo de la petición. Abre un *connection pool* de `mssql` y ejecuta directamente el query `INSERT` en SQL Server.
6.  **Respuesta (Servidor -> Cliente):** La base de datos retorna el ID autogenerado del mantenimiento. El controlador responde al cliente con un status 200 y el ID en formato JSON.
7.  **Actualización UI (Cliente):** El navegador recibe el ID, lo guarda en el estado local (`state.js`), inicia visualmente el `timer.js` y despliega los acordeones del checklist para trabajar.

## Fase 3: Pipeline de Datos / Lógica Core

### 1. Transacciones SQL de Alta Integridad (Guardado de Checklist)
El proceso más crítico en la escritura de datos ocurre al "Finalizar un Mantenimiento". El controlador (`mantenimiento.controller.js`) debe actualizar el registro del mantenimiento y además insertar decenas de tareas completadas de forma atómica:

*   **Atomicidad con `mssql.Transaction`:** El sistema inicia una transacción explícita (`BEGIN TRANSACTION`). Si la actualización de la fecha de cierre falla o si al guardar alguna de las filas del checklist ocurre un error, se invoca un `transaction.rollback()`, dejando la base de datos intacta sin registros huérfanos.
*   **Prepared Statements (Consultas Preparadas):** Para insertar todas las actividades completadas enviadas desde el frontend, el backend utiliza `mssql.PreparedStatement`. Esto no solo protege el sistema contra Inyección SQL (especialmente en los campos de `Comentario`), sino que compila el query en memoria una sola vez para que el bucle `for` de inserciones se ejecute de manera altamente eficiente (Bulk Insert Pattern en bucles).

### 2. Procesamiento y Fusión de KPIs del Monitor (Transformación de Data)
El cálculo del "Estado de Troqueles" para el Monitor es la consulta analítica más pesada del sistema. El frontend requiere un JSON consolidado con el porcentaje de desgaste (producido vs meta), pero los datos provienen de múltiples orígenes transaccionales en SQL Server (tablas separadas de Materiales, Producción y Mantenimiento). El controlador (`monitor.controller.js`) resuelve esto combinando Node.js con SQL Avanzado:

1.  **Ejecución Paralela (`Promise.all`):**
    *   **Consulta de Piezas Producidas:** Usa Expresiones de Tabla Comunes (CTEs) para encontrar primero la *fecha del último mantenimiento* de cada troquel activo. Luego cruza esto con la base de datos de Producción (`EPSData.dbo.tblEtiquetaLiberacion`), sumando todas las piezas cortadas estrictamente *después* de esa fecha.
    *   **Consulta de Piezas por Producir:** Paralelamente, se ejecuta otra query para calcular la demanda, buscando en las tablas de producción cuántas etiquetas están en cola para el proceso asociado.
2.  **Mapeo en Memoria (Simulando Power BI):**
    En lugar de hacer *joins* inter-bases masivos, Node.js recibe los dos recordsets y los fusiona iterando con `.map()` y `.find()`. El backend asocia cada troquel con su respectiva demanda calculada y determina matemáticamente el `percentage` de completitud: `Math.round((produc / maximo) * 100)`.
3.  **Ordenamiento y Entrega:**
    Finalmente, el array resultante de objetos es ordenado de mayor a menor porcentaje (`monitorData.sort`) para que el frontend (ECharts) siempre coloque al troquel con mayor desgaste en la cima del gráfico de forma inmediata.

## Fase 4: Operación y Mantenimiento

### 1. Variables de Entorno (.env)
Para que el servidor local o de producción funcione, el archivo `back/.env` debe configurarse con los siguientes valores obligatorios:

```ini
DB_USER=mi_usuario_sql
DB_PASSWORD=mi_password_seguro
DB_SERVER=192.168.1.50             # IP del servidor SQL o "localhost"
DB_DATABASE=WaPP                   # Base de datos principal de mantenimientos
PORT=3000                          # Puerto donde escucha Node.js
NODE_ENV=development               # 'development' o 'production' (controla los logs)
APP_BASE_URL=https://192.168.4.65:3000  # URL base de la aplicación (utilizada para generar los links de los códigos QR)
```

### 2. Comandos del Día a Día
El repositorio requiere dos procesos independientes. Abre dos consolas (terminales):

*   **En la carpeta `back/` (Servidor):**
    *   `npm run dev`: Inicia el servidor usando `nodemon`, ideal para desarrollo ya que reinicia la API si hay cambios en el código.
    *   `npm start`: Comando estándar para iniciar el servidor sin hot-reload (generalmente `node server.js`).
*   **En la carpeta `client/` (Frontend):**
    *   `npm run build:css`: Ejecuta Tailwind CSS para compilar clases de `css/input.css` y escanea los archivos HTML/JS, generando el archivo unificado `css/output.css`. Indispensable tras agregar nuevas clases de utilidad.

### 3. Estrategia de Caché y Validación de Datos
*   **Validación de Entradas (Backend):** Toda petición a la API pasa por un Middleware (`back/middlewares/validator.js`) que usa la librería **Joi**. Si un frontend modificado u otro cliente envía un ID en formato texto cuando se requiere un entero, el middleware intercepta el *request* y devuelve un `400 Bad Request` instantáneo, protegiendo las queries SQL.
*   **Persistencia Local (Frontend):** Para prevenir pérdidas de trabajo en piso de planta, el cliente usa `localStorage` (`saveStateToStorage`). Si la conexión falla temporalmente o el técnico recarga la web accidentalmente, el *checklist* y el *temporizador* persisten en la memoria del navegador.

### 4. Troubleshooting (Errores Comunes y Soluciones)
1.  **Error de Base de Datos `[DATABASE_ERROR] ECONNREFUSED`**
    *   **Causa:** El backend no puede alcanzar la base de datos SQL Server.
    *   **Solución:** Verificar que `DB_SERVER` en `.env` sea correcto, que la red local tenga alcance a esa IP y que SQL Server tenga habilitado TCP/IP por el puerto 1433.
2.  **Validación fallida `[VALIDATION_ERROR] 400 Bad Request` al guardar**
    *   **Causa:** El array de actividades o IDs enviados al endpoint no cumple el esquema Joi.
    *   **Solución:** Revisar el payload del Request en la pestaña "Network" del navegador; asegurarse de que `actividadesCompletadas` sea un arreglo con al menos un elemento válido.
3.  **Advertencia de Seguridad SSL en el Navegador (`ERR_CERT_AUTHORITY_INVALID`)**
    *   **Causa:** El servidor levanta en `HTTPS` usando los certificados locales `cert.pem` y `key.pem` que son autofirmados.
    *   **Solución:** En desarrollo local, haz click en "Avanzado" -> "Continuar a localhost (inseguro)" en tu navegador.
4.  **No se aplican los nuevos estilos de Tailwind**
    *   **Causa:** El motor de Tailwind no ha escaneado los nuevos cambios.
    *   **Solución:** Ejecutar `npm run build:css` en la carpeta `client/`.

### 5. Permisos Necesarios
*   **Permisos de SO:** Permisos de lectura en el servidor para acceder a `cert.pem` y `key.pem` a nivel sistema. Permiso de escritura en la carpeta `back/logs/` para rotación de Winston.
*   **Permisos SQL Server:** El usuario especificado en `DB_USER` debe tener permisos de **Lectura y Escritura (INSERT/UPDATE/DELETE)** en el esquema/base de datos donde reside la tabla de Mantenimientos (`WaPP`), y **solo Lectura (SELECT)** para cruzar información en las bases de Producción auxiliares (`EPSData` y `EPS` o equivalentes).

## Fase 5: Lógica de Negocio y Guía de Extensión

### 1. Entidades Principales y Reglas Estrictas
*   **Troquel:** Un molde que tiene un límite máximo de vida útil esperado (`MaximoPisadas`). Para ser elegible, debe estar activo (`bActivo = 1`).
*   **Sesión de Mantenimiento:** Una vez insertado en SQL con `GETDATE()`, **no se puede modificar** de forma manual ni alterar su creador (`idUsuario`).
*   **Regla de Integridad de Actividades:** No es posible cerrar un mantenimiento con un checklist 100% en blanco. El botón final queda deshabilitado en frontend y `Joi` lo rechazaría (`min(1)`) en backend.
*   **Estatus de Actividad:** Solo son válidos tres estados: `'Completado'`, `'No Completado'`, y `'No Aplica'`.

### 2. Transformaciones Clave de Datos
*   **Data de Actividades (Backend a Frontend):** El endpoint `/api/actividades` extrae una lista plana de actividades desde SQL. El cliente agrupa visualmente estos datos usando atributos preestablecidos por sección para inyectarlos en las plantillas (Template) del acordeón, transformando datos estáticos de BD en una vista interactiva de checkboxes y campos de texto.
*   **Conversión JSON de Power BI:** En el monitor, en lugar de retornar tablas normalizadas crudas, el backend fusiona objetos (`datosProducidas` + `datosLiberaciones`) y escupe un único array adaptado a los requisitos exactos de la librería ECharts, calculando el ratio final de porcentaje antes de tocar la red.

### 3. Guía de Extensión Paso a Paso

#### ¿Cómo agregar un nuevo KPI en el Monitor?
1.  **Backend (DB/Controller):** Modifica el archivo `back/controllers/monitor.controller.js`. Extrae el nuevo dato añadiéndolo al query SQL (ej. costo acumulado) o agregando una consulta adicional si viene de otra tabla.
2.  **Backend (Map):** Incorpora el nuevo campo (ej. `costo: row.costoCalculado`) en el retorno del `.map()` dentro del arreglo `monitorData`.
3.  **Frontend (UI):** Abre `client/index.html`, busca el contenedor `.stats-row` dentro de la tarjeta dinámica y agrega un nuevo `.stat-block` con su respectivo `id`.
4.  **Frontend (Lógica):** En el archivo JavaScript encargado del monitor, actualiza la función que dibuja los datos (ej. `updateFocusCard`) inyectando el valor: `$('#mi-nuevo-id').textContent = datos.costo;`.

#### ¿Cómo agregar una nueva columna de Filtro en el Historial?
1.  **Frontend (HTML):** Ve a `client/index.html` (pestaña historial), copia una estructura de tabla `<th class="th-filter">` y renombra los IDs de su popup respectivo.
2.  **Frontend (JS):** En `client/js/pages/historial.js`, captura el evento click del nuevo filtro. Al hacer *fetch* a la API, agrega tu nuevo valor a los parámetros de URL (Query String), ej. `&estado=Cancelado`.
3.  **Backend (Controller):** Abre `back/controllers/historial.controller.js`. Recibe tu parámetro mediante `req.query.estado`. Agrega de forma dinámica la condición de texto a la query principal de SQL Server: `if(estado) query += ' AND Estado = @Estado'`.

#### ¿Cómo agregar una nueva Actividad / Tarea al Checklist?
Gracias al diseño basado en base de datos, **no es necesario tocar el código fuente**.
1.  Ingresa a tu gestor de base de datos (SQL Server Management Studio).
2.  Haz un `INSERT` en la tabla maestra de Actividades / Checklist de la base de datos `WaPP`.
3.  Asigna la descripción y asegúrate de relacionarlo con la categoría correcta.
4.  Al refrescar la página, el frontend descargará la lista actualizada y generará automáticamente la fila y el checkbox gracias a la función `renderAccordions()`.
