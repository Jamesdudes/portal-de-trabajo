# Portal de Trabajo (Plataforma Profesional de Empleo)
**Sistema Web Profesional de Empleo y Vinculación Laboral**  

---

## 1. Arquitectura Tecnológica Estricta (Requisitos Académicos)

El sistema ha sido desarrollado exclusivamente bajo las tecnologías solicitadas:

### Frontend
- **HTML5:** Estructura semántica estricta (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`).
- **CSS3 Puro:** Diseño minimalista, elegante y corporativo en `frontend/css/styles.css` con variables CSS personalizadas, Flexbox y CSS Grid. **Cero frameworks** (sin Tailwind, Bootstrap ni librerías de estilos).
- **JavaScript Vanilla (Nativo):** Lógica modular en `frontend/js/app.js`, `frontend/js/api.js`, `frontend/js/phoneInput.js`, `frontend/js/state.js` e `frontend/js/icons.js`. Enrutamiento SPA sin recargas de página y consumo de API REST mediante `fetch()`.
- **Iconografía Profesional:** Iconos vectoriales SVG limpios estilo Lucide en `frontend/js/icons.js`. **Cero emojis en la interfaz**.
- **Identidad Visual por Roles (4 Colores Institucionales):**
  - **Público / General:** Azul Marino (`#1e3a8a` / `#1e40af`)
  - **Candidato:** Verde Profesional (`#15803d` / `#16a34a`)
  - **Empresa / Empleador:** Morado Corporativo (`#7c3aed` / `#6d28d9`)
  - **Administrador:** Naranja de Supervisión (`#ea580c` / `#c2410c`)

### Backend
- **Node.js:** Servidor HTTP creado exclusivamente con el módulo `http` nativo de Node.js en `backend/server.js`. **Sin Express ni frameworks**.
- **API RESTful:** Enrutamiento modular en `backend/routes/router.js` con endpoints `/api/auth`, `/api/jobs`, `/api/applications`, `/api/alerts`, `/api/reviews`, `/api/forums`, `/api/admin` y `/api/files`.
- **Driver Oficial de MongoDB:** Operaciones directas con el driver oficial `mongodb` (v7) en `backend/config/db.js`.
- **Almacenamiento Binario Persistente (GridFS):** Colecciones nativas `uploads.files` y `uploads.chunks` para fotografías de perfil, banners y currículums (PDF/DOCX) con comprobación de magic bytes.
- **Seguridad:**
  - Hashing de contraseñas con `bcryptjs`.
  - Bloqueo preventivo de cuentas tras 5 intentos fallidos.
  - Bitácora inmutable de moderación (`moderation_logs`).
  - **Restricción estricta:** El administrador no puede modificar datos privados ni currículums de los usuarios; solo modera el estado (Activa / Suspendida).

---

## 2. Pasos para Ejecutar el Proyecto en Local

### Requisitos Previos
1. **Node.js:** Versión 18 o superior (recomendado Node 20 LTS o 22).
2. **MongoDB Community Server:** Versión 7.0 (o superior) instalado y ejecutándose en el puerto estándar `27017`.

### Paso 1: Iniciar el Servicio de MongoDB
Asegúrate de que el motor de MongoDB esté activo:
- En **Windows**:
  Verifica en la aplicación *Servicios* que el servicio `MongoDB` esté en estado *En ejecución*, o ejecuta en PowerShell / CMD:
  ```powershell
  net start MongoDB
  ```
- En **Linux / macOS**:
  ```bash
  sudo systemctl start mongod
  ```
- Puedes verificar la conexión abriendo una terminal y ejecutando `mongosh`:
  ```bash
  mongosh "mongodb://127.0.0.1:27017/portal_trabajo"
  ```

### Paso 2: Clonar o Abrir el Proyecto en Visual Studio Code
Abre la carpeta del proyecto en VS Code (`Ctrl + ~` para abrir la terminal integrada).

### Paso 3: Instalar Dependencias con npm
Ejecuta en la raíz del proyecto:
```bash
npm install
```
*(Instala únicamente el driver oficial `mongodb`, `bcryptjs` y `dotenv`).*

### Paso 4: Iniciar el Servidor del Portal de Trabajo
Ejecuta cualquiera de los siguientes comandos:

- **Modo estándar (Puerto 3000):**
  ```bash
  npm start
  ```
  o bien:
  ```bash
  node backend/server.js
  ```

- **Si el puerto 3000 está ocupado (por ejemplo, en el puerto 4000):**
  - En Windows (PowerShell):
    ```powershell
    $env:PORT=4000; node backend/server.js
    ```
  - En Linux / macOS / Bash:
    ```bash
    PORT=4000 node backend/server.js
    ```

### Paso 5: Acceder desde el Navegador
Abre tu navegador (Chrome, Edge, Firefox, Brave) en:
```
http://localhost:3000
```
*(o `http://localhost:4000` si cambiaste de puerto).*

---

## 3. Credenciales Preconfiguradas para Pruebas

El sistema inicializa automáticamente las cuentas y colecciones necesarias en MongoDB:

| Rol | Correo Electrónico | Contraseña | Pantallas Principales |
| :--- | :--- | :--- | :--- |
| **Candidato** | `samuel.villa@catolica.edu.sv` | `Password123` | Mi Perfil (U-01), Postulaciones (U-02), Alertas (U-03) |
| **Empresa** | `reclutamiento@techcorp.sv` | `Password123` | Mi Empresa (E-01), Ofertas (E-02), Candidatos (E-03) |
| **Administrador** | `admin.portal@catolica.edu.sv` | `Password123` | Panel Admin (A-01), Auditoría y Diagnóstico |

---

## 4. Funcionalidades Destacadas

1. **Formato Automático de Teléfonos:**
   - Formateo inteligente en tiempo real según se escribe (`77778888` se convierte en `7777-8888`).
   - Selector internacional desplegable con buscador dinámico por país o código (SV +503, US/CA +1, MX +52, GT +502, HN +504, NI +505, CR +506, PA +507, ES +34, otros).
   - Bloqueo preventivo de letras y prevención de prefijos duplicados.
2. **Carga Real de Imágenes en MongoDB GridFS:**
   - Fotografía de perfil y portada/banner para Candidatos.
   - Logo corporativo y portada para Empresas.
   - Vista previa inmediata en navegador y persistencia en `uploads.files` / `uploads.chunks`.
3. **Carga y Descarga de Currículum (PDF/DOCX):**
   - Subida directa desde la computadora a MongoDB GridFS.
   - Vista previa con nombre del archivo y tamaño en KB/MB.
   - Botón de apertura en navegador (`/api/files/:id`) y botón de descarga directa (`/api/files/:id/download`).
   - El empleador puede consultar y descargar los currículums de sus postulantes en `E-03`.
4. **Seguridad y Moderación Administrativa:**
   - Diagnóstico del servidor exclusivo en `A-01` sin exponer credenciales ni cadenas de conexión públicas.
   - Búsqueda y filtrado de usuarios por rol y estado.
   - Modal de suspensión con motivo obligatorio registrado en bitácora inmutable.
   - El administrador no puede vulnerar los datos personales privados de los usuarios.
