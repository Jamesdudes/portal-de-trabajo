# Especificación de Esquemas de Base de Datos - MongoDB
**Proyecto:** Portal de Trabajo PWA  
**Institución:** Universidad Católica de El Salvador (UNICAES)  
**Facultad:** Ingeniería y Arquitectura (FIA)  
**Carrera:** Ingeniería en Desarrollo de Software  
**Catedrático:** Ing. José Emerson Aguilar De León  

---

## 1. Arquitectura de Datos NoSQL en MongoDB

El sistema utiliza MongoDB para persistir los documentos estructurados en formato BSON/JSON. La arquitectura se organiza en 9 colecciones desacopladas con relaciones referenciales mediante identificadores únicos (`_id`).

### 2. Colecciones y Modelos de Datos

#### 2.1 Colección: `users`
Almacena las cuentas de usuario y credenciales con contraseñas cifradas en `bcryptjs`.
```json
{
  "_id": "usr-cand-1",
  "email": "samuel.villa@catolica.edu.sv",
  "passwordHash": "$2a$10$eO... (hash seguro)",
  "role": "candidato", // "candidato" | "empleador" | "admin"
  "firstName": "Samuel Ernesto",
  "lastName": "Villa Varela",
  "phone": "+503 7234-8901",
  "title": "Desarrollador Frontend & UI/UX Jr.",
  "location": "Santa Ana, El Salvador",
  "bio": "Estudiante de 4to año de IDS...",
  "status": "Activa", // "Activa" | "Bloqueada"
  "profileViews": 1245,
  "companyId": "comp-1", // Solo si role === "empleador"
  "cv": {
    "fileName": "CV_Samuel_Villa.pdf",
    "fileSize": "1.4 MB",
    "uploadDate": "2026-10-18",
    "summaryTitle": "Frontend Developer",
    "skills": ["HTML5", "CSS3", "JavaScript", "Node.js", "MongoDB"]
  },
  "createdAt": "ISODate"
}
```

#### 2.2 Colección: `companies`
Almacena los perfiles corporativos verificados.
```json
{
  "_id": "comp-1",
  "name": "TechCorp El Salvador",
  "legalName": "TechCorp El Salvador S.A. de C.V.",
  "logo": "https://...",
  "industry": "Tecnología / Software",
  "size": "150-500 empleados",
  "location": "San Salvador, Antiguo Cuscatlán",
  "website": "https://techcorp.sv",
  "description": "Empresa líder de ingeniería...",
  "verified": true,
  "averageRating": 4.8,
  "reviewCount": 38,
  "status": "Activa",
  "createdAt": "ISODate"
}
```

#### 2.3 Colección: `jobs`
Ofertas laborales publicadas por empresas o supervisadas por el administrador.
```json
{
  "_id": "job-101",
  "title": "Desarrollador Web JavaScript & Node.js",
  "companyId": "comp-1",
  "companyName": "TechCorp El Salvador",
  "companyLogo": "https://...",
  "location": "San Salvador (Híbrido)",
  "modality": "Híbrido", // "Presencial" | "Remoto" | "Híbrido"
  "contractType": "Tiempo Completo", // "Tiempo Completo" | "Medio Tiempo" | "Pasantía / Prácticas" | "Por Proyecto"
  "experienceLevel": "1-2 años",
  "sector": "Tecnología / Software",
  "salaryMin": 1400,
  "salaryMax": 1900,
  "description": "Buscamos un Ingeniero...",
  "responsibilities": ["..."],
  "requirements": ["..."],
  "benefits": ["..."],
  "contactEmail": "empleos@techcorp.sv",
  "contactPhone": "+503 2244-5500",
  "status": "Activa", // "Activa" | "Cerrada"
  "publishedAt": "2026-10-21",
  "expiresAt": "2026-11-25",
  "featured": true
}
```

#### 2.4 Colección: `applications`
Postulaciones realizadas por candidatos a ofertas laborales específicas.
```json
{
  "_id": "app-501",
  "jobId": "job-102",
  "jobTitle": "Diseñador UI/UX & Interfaces Digitales",
  "companyId": "comp-2",
  "companyName": "Innova Solutions",
  "companyLogo": "https://...",
  "candidateId": "usr-cand-1",
  "candidateName": "Samuel Ernesto Villa Varela",
  "candidateEmail": "samuel.villa@catolica.edu.sv",
  "candidatePhone": "+503 7234-8901",
  "candidateTitle": "Desarrollador Frontend & UI/UX Jr.",
  "appliedAt": "2026-10-23",
  "status": "En proceso", // "Enviada" | "En proceso" | "Finalista" | "Contratado" | "Descartado"
  "cvFileName": "CV_Samuel_Villa.pdf",
  "history": [
    {
      "date": "2026-10-23 14:30",
      "status": "Enviada",
      "note": "Postulación recibida."
    }
  ]
}
```

#### 2.5 Colección: `alerts`
Alertas automáticas de empleo configuradas por candidatos.
```json
{
  "_id": "alert-1",
  "candidateId": "usr-cand-1",
  "keyword": "Desarrollador Web",
  "location": "San Salvador",
  "frequency": "Diaria", // "Diaria" | "Semanal"
  "active": true,
  "createdAt": "2026-10-15",
  "matchedCount": 3
}
```

#### 2.6 Colección: `reviews`
Valoraciones y calificaciones emitidas por candidatos a empresas.
```json
{
  "_id": "rev-1",
  "companyId": "comp-1",
  "companyName": "TechCorp El Salvador",
  "candidateId": "usr-cand-1",
  "candidateName": "Samuel Ernesto Villa Varela",
  "candidateRole": "Ex Pasante",
  "rating": 5,
  "title": "Excelente cultura de mentoría",
  "comment": "Trabajé en el equipo...",
  "date": "2026-10-19",
  "status": "Aprobada",
  "scores": {
    "culture": 5.0,
    "salary": 4.8,
    "growth": 5.0,
    "workLife": 4.9
  }
}
```

#### 2.7 Colección: `articles`
Recursos de orientación laboral, guías de CV Harvard y método STAR.

#### 2.8 Colección: `forums`
Hilos de debate estudiantil y laboral con respuestas anidadas.

#### 2.9 Colección: `moderation_logs`
Pista de auditoría inmutable del administrador (`A-01`) que registra fecha, administrador, categoría, ID objetivo, acción y motivo.
