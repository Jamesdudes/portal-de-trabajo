import bcrypt from 'bcryptjs';

const defaultPasswordHash = bcrypt.hashSync('Password123', 10);

export const SEED_USERS = [
  {
    _id: 'usr-cand-1',
    email: 'samuel.villa@catolica.edu.sv',
    passwordHash: defaultPasswordHash,
    role: 'candidato',
    firstName: 'Samuel Ernesto',
    lastName: 'Villa Varela',
    avatar: '',
    phone: '503-7234-8901',
    title: 'Desarrollador Web Full Stack & UI/UX',
    location: 'San Salvador, El Salvador',
    bio: 'Profesional en ingeniería de software con experiencia comprobada en arquitectura frontend, diseño centrado en el usuario, bases de datos NoSQL y desarrollo de APIs RESTful escalables.',
    status: 'Activa',
    profileViews: 1245,
    experience: [
      {
        id: 'exp-1',
        role: 'Desarrollador Frontend & Web',
        company: 'Innovatech Studio',
        location: 'San Salvador (Híbrido)',
        startDate: '2024-01',
        endDate: 'Actualidad',
        current: true,
        description: 'Construcción y optimización de interfaces web de alto rendimiento. Integración con servicios RESTful y mantenimiento de sistemas de diseño.'
      },
      {
        id: 'exp-2',
        role: 'Desarrollador Web Trainee',
        company: 'Digital Solutions Group',
        location: 'San Salvador',
        startDate: '2023-02',
        endDate: '2023-12',
        current: false,
        description: 'Desarrollo de módulos interactivos para aplicaciones de comercio electrónico y portales de clientes.'
      }
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'Instituto Tecnológico Superior de Centroamérica',
        degree: 'Ingeniería en Desarrollo de Software',
        fieldOfStudy: 'Sistemas Informáticos y Computación',
        startDate: '2020',
        endDate: '2024',
        current: false,
        description: 'Énfasis en arquitectura de software, bases de datos y seguridad de aplicaciones web.'
      }
    ],
    skills: ['HTML5', 'CSS3', 'JavaScript Vanilla', 'Node.js', 'MongoDB', 'REST APIs', 'Git', 'UI/UX Design', 'Scrum'],
    languages: [
      { language: 'Español', level: 'Nativo' },
      { language: 'Inglés', level: 'Profesional (B2)' }
    ],
    certifications: [
      {
        id: 'cert-1',
        name: 'Full Stack Web Architecture & APIs',
        issuingOrganization: 'Global Tech Institute',
        issueDate: '2024',
        credentialUrl: 'https://credentials.example.org/cert-8812'
      }
    ],
    links: {
      portfolio: 'https://github.com/samuelvilla',
      linkedin: 'https://linkedin.com/in/samuelvilla-dev',
      github: 'https://github.com/samuelvilla',
      website: 'https://samuelvilla.dev'
    },
    privacy: {
      showPhoneToCompanies: true,
      showEmailToCompanies: true,
      isProfilePublic: true
    },
    cv: {
      fileName: 'CV_Samuel_Villa_Software_Engineer_2026.pdf',
      fileSize: '1.4 MB',
      uploadDate: '2026-10-18',
      summaryTitle: 'Full Stack Web Developer & Software Engineer',
      skills: ['HTML5', 'CSS3', 'JavaScript Vanilla', 'Node.js', 'MongoDB', 'REST APIs', 'Git', 'UI/UX Design']
    },
    createdAt: new Date('2026-10-01T08:00:00Z')
  },
  {
    _id: 'usr-cand-2',
    email: 'abigail.martinez@catolica.edu.sv',
    passwordHash: defaultPasswordHash,
    role: 'candidato',
    firstName: 'Abigail Esmeralda',
    lastName: 'Martínez Martínez',
    avatar: '',
    phone: '503-7890-1234',
    title: 'Ingeniera de Software & QA Automation Specialist',
    location: 'San Salvador, El Salvador',
    bio: 'Especialista en aseguramiento de calidad (QA), pruebas automatizadas y análisis de sistemas de software. Experiencia en metodologías ágiles Scrum y estándares ISTQB.',
    status: 'Activa',
    profileViews: 860,
    experience: [
      {
        id: 'exp-201',
        role: 'QA Engineer & Test Analyst',
        company: 'Innova Solutions',
        location: 'San Salvador',
        startDate: '2023-06',
        endDate: 'Actualidad',
        current: true,
        description: 'Diseño y ejecución de planes de pruebas de regresión, integración y automatización con Postman y suites de pruebas.'
      }
    ],
    education: [
      {
        id: 'edu-201',
        institution: 'Universidad Panamericana',
        degree: 'Licenciatura en Ciencias de la Computación',
        fieldOfStudy: 'Ingeniería de Software y Calidad',
        startDate: '2019',
        endDate: '2023',
        current: false,
        description: 'Graduada con honores académicos.'
      }
    ],
    skills: ['QA Testing', 'JavaScript', 'Postman', 'Jira', 'SQL', 'MongoDB', 'Scrum', 'CI/CD'],
    languages: [
      { language: 'Español', level: 'Nativo' },
      { language: 'Inglés', level: 'Avanzado (C1)' }
    ],
    certifications: [
      {
        id: 'cert-201',
        name: 'ISTQB Certified Tester Foundation Level (CTFL)',
        issuingOrganization: 'ISTQB International',
        issueDate: '2023',
        credentialUrl: 'https://istqb.org/verify/ctfl-4910'
      }
    ],
    links: {
      portfolio: 'https://github.com/abigailmartinez',
      linkedin: 'https://linkedin.com/in/abigail-martinez-qa',
      github: 'https://github.com/abigailmartinez',
      website: ''
    },
    privacy: {
      showPhoneToCompanies: true,
      showEmailToCompanies: true,
      isProfilePublic: true
    },
    cv: {
      fileName: 'CV_Abigail_Martinez_QA_2026.pdf',
      fileSize: '950 KB',
      uploadDate: '2026-10-12',
      summaryTitle: 'QA Engineer & Test Automation Specialist',
      skills: ['JavaScript', 'Testing', 'Postman', 'Jira', 'SQL', 'Scrum']
    },
    createdAt: new Date('2026-10-05T09:30:00Z')
  },
  {
    _id: 'usr-emp-1',
    email: 'reclutamiento@techcorp.sv',
    passwordHash: defaultPasswordHash,
    role: 'empleador',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    phone: '503-2244-5500',
    title: 'Director de Adquisición de Talento',
    companyId: 'comp-1',
    status: 'Activa',
    createdAt: new Date('2026-09-15T10:00:00Z')
  },
  {
    _id: 'usr-emp-2',
    email: 'talento@innovasolutions.sv',
    passwordHash: defaultPasswordHash,
    role: 'empleador',
    firstName: 'Elena',
    lastName: 'Salguero',
    phone: '503-2450-8800',
    title: 'HR Business Partner',
    companyId: 'comp-2',
    status: 'Activa',
    createdAt: new Date('2026-09-20T11:00:00Z')
  },
  {
    _id: 'usr-admin-1',
    email: 'admin.portal@catolica.edu.sv',
    passwordHash: defaultPasswordHash,
    role: 'admin',
    firstName: 'Administrador',
    lastName: 'del Sistema',
    phone: '503-2484-0600',
    title: 'Administrador General de la Plataforma',
    status: 'Activa',
    createdAt: new Date('2026-09-01T08:00:00Z')
  }
];

export const SEED_COMPANIES = [
  {
    _id: 'comp-1',
    name: 'TechCorp El Salvador',
    legalName: 'TechCorp El Salvador S.A. de C.V.',
    logo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=160&auto=format&fit=crop&q=80',
    industry: 'Tecnología / Software',
    size: '150-500 empleados',
    location: 'San Salvador, Antiguo Cuscatlán',
    website: 'https://techcorp.sv',
    description: 'Empresa líder de ingeniería y consultoría de software en Centroamérica, especializada en desarrollo en la nube, microservicios y soluciones fintech escalables.',
    verified: true,
    averageRating: 4.8,
    reviewCount: 38,
    status: 'Activa',
    createdAt: new Date('2026-09-10T08:00:00Z')
  },
  {
    _id: 'comp-2',
    name: 'Innova Solutions',
    legalName: 'Innova Solutions Centroamérica S.A.',
    logo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=160&auto=format&fit=crop&q=80',
    industry: 'Diseño & Desarrollo Digital',
    size: '50-150 empleados',
    location: 'Santa Ana, El Salvador',
    website: 'https://innovasolutions.sv',
    description: 'Agencia de productos digitales enfocada en UX/UI interactivo, aplicaciones móviles y transformación digital para el sector retail y bancario.',
    verified: true,
    averageRating: 4.5,
    reviewCount: 22,
    status: 'Activa',
    createdAt: new Date('2026-09-12T09:00:00Z')
  },
  {
    _id: 'comp-3',
    name: 'Banco Cuscatlán',
    legalName: 'Banco Cuscatlán de El Salvador S.A.',
    logo: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=160&auto=format&fit=crop&q=80',
    industry: 'Banca y Finanzas',
    size: '1000+ empleados',
    location: 'Santa Tecla, La Libertad',
    website: 'https://bancocuscatlan.com',
    description: 'Institución financiera de referencia con más de 50 años facilitando el crecimiento de personas y empresas a través de servicios bancarios de vanguardia.',
    verified: true,
    averageRating: 4.6,
    reviewCount: 64,
    status: 'Activa',
    createdAt: new Date('2026-09-01T08:00:00Z')
  },
  {
    _id: 'comp-4',
    name: 'Aeroman Global Tech',
    legalName: 'Aeroman El Salvador S.A. de C.V.',
    logo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=160&auto=format&fit=crop&q=80',
    industry: 'Ingeniería y Aeronáutica',
    size: '1000+ empleados',
    location: 'San Luis Talpa, La Paz',
    website: 'https://aeroman.com.sv',
    description: 'Centro de mantenimiento aeronáutico de clase mundial y desarrollo de sistemas de telemetría e ingeniería industrial.',
    verified: true,
    averageRating: 4.7,
    reviewCount: 45,
    status: 'Activa',
    createdAt: new Date('2026-09-05T10:00:00Z')
  }
];

export const SEED_JOBS = [
  {
    _id: 'job-101',
    title: 'Desarrollador Web JavaScript & Node.js',
    companyId: 'comp-1',
    companyName: 'TechCorp El Salvador',
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=160&auto=format&fit=crop&q=80',
    location: 'San Salvador (Híbrido)',
    modality: 'Híbrido',
    contractType: 'Tiempo Completo',
    experienceLevel: '1-2 años',
    sector: 'Tecnología / Software',
    salaryMin: 1400,
    salaryMax: 1900,
    description: 'Buscamos un Ingeniero de Software con pasión por construir aplicaciones web limpias y eficientes usando estándares web nativos y Node.js. Trabajarás en proyectos para clientes en EE.UU. y Centroamérica.',
    responsibilities: [
      'Desarrollar componentes web modulares con HTML5, CSS3 y JavaScript nativo',
      'Construir y consumir servicios RESTful en Node.js integrados con MongoDB',
      'Optimizar el rendimiento y accesibilidad según estándares web',
      'Participar en ceremonias ágiles Scrum y revisiones de código colaborativas'
    ],
    requirements: [
      'Al menos 1 año de experiencia práctica con JavaScript y Node.js',
      'Dominio de HTML semántico, CSS moderno y bases de datos NoSQL / MongoDB',
      'Manejo de Git y buenas prácticas de desarrollo modular',
      'Buenas habilidades de comunicación oral y escrita en español'
    ],
    benefits: [
      'Modalidad híbrida (3 días remoto, 2 en oficina corporativa)',
      'Seguro médico y dental privado pagado al 100%',
      'Bono anual por rendimiento y presupuesto para certificaciones',
      'Horarios flexibles y excelente clima laboral'
    ],
    contactEmail: 'empleos@techcorp.sv',
    contactPhone: '+503 2244-5500',
    status: 'Activa',
    publishedAt: '2026-10-21',
    expiresAt: '2026-11-25',
    featured: true
  },
  {
    _id: 'job-102',
    title: 'Diseñador UI/UX & Interfaces Digitales',
    companyId: 'comp-2',
    companyName: 'Innova Solutions',
    companyLogo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=160&auto=format&fit=crop&q=80',
    location: 'Santa Ana, El Salvador',
    modality: 'Presencial',
    contractType: 'Tiempo Completo',
    experienceLevel: '3-5 años',
    sector: 'Diseño & Creatividad',
    salaryMin: 1200,
    salaryMax: 1600,
    description: 'Únete a nuestro laboratorio de innovación digital en Santa Ana para liderar la arquitectura de información, diseño interactivo y experiencia de usuario.',
    responsibilities: [
      'Crear flujos de usuario, wireframes y prototipos interactivos de alta fidelidad',
      'Conducir pruebas de usabilidad e investigación cualitativa con usuarios reales',
      'Colaborar estrechamente con el equipo de desarrollo frontend',
      'Documentar guías de estilo, tokens de diseño y patrones de interacción'
    ],
    requirements: [
      'Experiencia demostrable con portafolio de proyectos web o móviles',
      'Dominio de herramientas de diseño y arquitectura de información',
      'Conocimiento sólido de accesibilidad web y diseño responsivo'
    ],
    benefits: [
      'Plan dental y subsidio de almuerzos',
      'Espacio de co-working moderno con café de especialidad ilimitado',
      'Viernes de jornada continua (salida a las 2:00 PM)'
    ],
    contactEmail: 'talento@innovasolutions.sv',
    contactPhone: '+503 2450-8800',
    status: 'Activa',
    publishedAt: '2026-10-23',
    expiresAt: '2026-11-30',
    featured: true
  },
  {
    _id: 'job-103',
    title: 'Pasante de Desarrollo de Software (Pasantía)',
    companyId: 'comp-1',
    companyName: 'TechCorp El Salvador',
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=160&auto=format&fit=crop&q=80',
    location: 'Remoto (El Salvador)',
    modality: 'Remoto',
    contractType: 'Pasantía / Prácticas',
    experienceLevel: 'Sin experiencia',
    sector: 'Tecnología / Software',
    salaryMin: 450,
    salaryMax: 600,
    description: 'Programa para talentos junior o recién egresados de carreras de Ingeniería, Sistemas o áreas afines. Ofrecemos mentoría directa con Tech Leads.',
    responsibilities: [
      'Asistir en la resolución de bugs menores y tareas de desarrollo web',
      'Escribir pruebas unitarias guiadas por un mentor senior',
      'Aprender buenas prácticas de CI/CD, JavaScript y arquitectura REST'
    ],
    requirements: [
      'Estudiante avanzado o graduado de carreras de tecnología o afines',
      'Conocimientos básicos en programación orientada a objetos o desarrollo web',
      'Ganas continuas de aprender y proactividad'
    ],
    benefits: [
      'Estipendio económico mensual competitivo',
      'Flexibilidad horaria y soporte para capacitaciones continuas',
      'Posibilidad de contratación como Ingeniero Jr. al graduarse'
    ],
    contactEmail: 'internships@techcorp.sv',
    contactPhone: '503-2244-5501',
    status: 'Activa',
    publishedAt: '2026-10-24',
    expiresAt: '2026-11-20',
    featured: true
  },
  {
    _id: 'job-104',
    title: 'Analista de Seguridad de la Información',
    companyId: 'comp-3',
    companyName: 'Banco Cuscatlán',
    companyLogo: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=160&auto=format&fit=crop&q=80',
    location: 'Santa Tecla, La Libertad',
    modality: 'Híbrido',
    contractType: 'Tiempo Completo',
    experienceLevel: '3-5 años',
    sector: 'Banca y Finanzas',
    salaryMin: 2100,
    salaryMax: 2800,
    description: 'Supervisa y fortalece la postura de ciberseguridad en nuestra infraestructura tecnológica, garantizando cumplimiento normativo bancario de la SSF.',
    responsibilities: [
      'Monitorear alertas de seguridad y eventos de autenticación',
      'Ejecutar escaneos periódicos de vulnerabilidades de aplicaciones web',
      'Garantizar cumplimiento con ISO 27001 y normativas locales'
    ],
    requirements: [
      'Grado en Ingeniería en Sistemas, Ciberseguridad o carreras afines',
      'Experiencia de 3 años en entornos corporativos o financieros',
      'Conocimientos de autenticación segura, hashing de contraseñas y permisos RBAC'
    ],
    benefits: [
      'Tasas preferenciales en créditos bancarios',
      'Bono de escolaridad y seguro médico familiar',
      'Aguinaldo institucional superior al de ley'
    ],
    contactEmail: 'seguridad.empleo@bancocuscatlan.com',
    contactPhone: '+503 2212-2000',
    status: 'Activa',
    publishedAt: '2026-10-19',
    expiresAt: '2026-11-18',
    featured: false
  },
  {
    _id: 'job-105',
    title: 'Ingeniero de Calidad y Pruebas QA',
    companyId: 'comp-1',
    companyName: 'TechCorp El Salvador',
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=160&auto=format&fit=crop&q=80',
    location: 'Remoto (El Salvador)',
    modality: 'Remoto',
    contractType: 'Tiempo Completo',
    experienceLevel: '1-2 años',
    sector: 'Tecnología / Software',
    salaryMin: 1300,
    salaryMax: 1750,
    description: 'Diseño y ejecución de planes de pruebas funcionales y de regresión para aplicaciones web e interfaces RESTful.',
    responsibilities: [
      'Diseñar matrices de pruebas y casos de uso',
      'Reportar anomalías detalladas y coordinar correcciones con el equipo dev',
      'Validar endpoints REST y flujos de usuario completos'
    ],
    requirements: [
      '1 a 2 años de experiencia en aseguramiento de calidad de software',
      'Conocimiento en JavaScript para scripting de pruebas',
      'Familiaridad con metodologías ágiles Scrum'
    ],
    benefits: [
      'Trabajo 100% remoto desde cualquier parte de El Salvador',
      'Equipo de cómputo proporcionado por la empresa',
      'Bono de conectividad mensual para internet de alta velocidad'
    ],
    contactEmail: 'qa-jobs@techcorp.sv',
    contactPhone: '+503 2244-5502',
    status: 'Activa',
    publishedAt: '2026-10-22',
    expiresAt: '2026-11-28',
    featured: false
  },
  {
    _id: 'job-106',
    title: 'Desarrollador Backend Node.js & Microservicios (Vacante Cerrada)',
    companyId: 'comp-4',
    companyName: 'Aeroman Global Tech',
    companyLogo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=160&auto=format&fit=crop&q=80',
    location: 'San Luis Talpa, La Paz',
    modality: 'Presencial',
    contractType: 'Tiempo Completo',
    experienceLevel: '+5 años',
    sector: 'Ingeniería y Aeronáutica',
    salaryMin: 2500,
    salaryMax: 3200,
    description: 'Esta vacante ha completado exitosamente su proceso de selección y contratación. Agradecemos el interés de todos los postulantes.',
    responsibilities: [
      'Desarrollo de servicios con Node.js nativo y MongoDB',
      'Gestión de datos distribuidos'
    ],
    requirements: [
      '5+ años de experiencia comprobable en backend'
    ],
    benefits: [
      'Transporte corporativo y almuerzo incluido'
    ],
    contactEmail: 'rh@aeroman.com.sv',
    contactPhone: '503-2347-1000',
    status: 'Cerrada',
    publishedAt: '2026-09-15',
    expiresAt: '2026-10-15',
    featured: false
  }
];

export const SEED_APPLICATIONS = [
  {
    _id: 'app-501',
    jobId: 'job-102',
    jobTitle: 'Diseñador UI/UX & Interfaces Digitales',
    companyId: 'comp-2',
    companyName: 'Innova Solutions',
    companyLogo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=160&auto=format&fit=crop&q=80',
    candidateId: 'usr-cand-1',
    candidateName: 'Samuel Ernesto Villa Varela',
    candidateEmail: 'samuel.villa@catolica.edu.sv',
    candidatePhone: '503-7234-8901',
    candidateTitle: 'Desarrollador Web Full Stack & UI/UX',
    appliedAt: '2026-10-23',
    status: 'En proceso',
    cvFileName: 'CV_Samuel_Villa_Software_Engineer_2026.pdf',
    history: [
      {
        date: '2026-10-23 14:30',
        status: 'Enviada',
        note: 'Postulación enviada a través de la plataforma Portal de Trabajo.'
      },
      {
        date: '2026-10-24 10:15',
        status: 'En proceso',
        note: 'Perfil revisado por Elena Salguero. Agendada primera entrevista técnica por Google Meet.'
      }
    ]
  },
  {
    _id: 'app-502',
    jobId: 'job-105',
    jobTitle: 'Ingeniero de Calidad y Pruebas QA',
    companyId: 'comp-1',
    companyName: 'TechCorp El Salvador',
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=160&auto=format&fit=crop&q=80',
    candidateId: 'usr-cand-2',
    candidateName: 'Abigail Esmeralda Martínez Martínez',
    candidateEmail: 'abigail.martinez@catolica.edu.sv',
    candidatePhone: '503-7890-1234',
    candidateTitle: 'Ingeniera de Software & QA Automation Specialist',
    appliedAt: '2026-10-22',
    status: 'Enviada',
    cvFileName: 'CV_Abigail_Martinez_QA_2026.pdf',
    history: [
      {
        date: '2026-10-22 16:45',
        status: 'Enviada',
        note: 'Postulación enviada correctamente.'
      }
    ]
  }
];

export const SEED_ALERTS = [
  {
    _id: 'alert-1',
    candidateId: 'usr-cand-1',
    keyword: 'Desarrollador Web',
    location: 'San Salvador',
    frequency: 'Diaria',
    active: true,
    createdAt: '2026-10-15',
    matchedCount: 3
  },
  {
    _id: 'alert-2',
    candidateId: 'usr-cand-1',
    keyword: 'Diseñador UI/UX',
    location: 'Santa Ana',
    frequency: 'Semanal',
    active: true,
    createdAt: '2026-10-18',
    matchedCount: 1
  },
  {
    _id: 'alert-3',
    candidateId: 'usr-cand-1',
    keyword: 'Pasantía Software',
    location: 'Remoto',
    frequency: 'Diaria',
    active: false,
    createdAt: '2026-10-10',
    matchedCount: 2
  }
];

export const SEED_REVIEWS = [
  {
    _id: 'rev-1',
    companyId: 'comp-1',
    companyName: 'TechCorp El Salvador',
    candidateId: 'usr-cand-1',
    candidateName: 'Samuel Ernesto Villa Varela',
    candidateRole: 'Desarrollador Frontend',
    rating: 5,
    title: 'Excelente cultura de mentoría e innovación técnica',
    comment: 'Trabajé en el equipo de frontend durante mis primeros proyectos. El equipo te acompaña constantemente, el código es de primer nivel y el equilibrio entre vida laboral y desarrollo profesional es sobresaliente.',
    date: '2026-10-19',
    status: 'Aprobada',
    scores: {
      culture: 5,
      salary: 4.8,
      growth: 5,
      workLife: 4.9
    }
  },
  {
    _id: 'rev-2',
    companyId: 'comp-2',
    companyName: 'Innova Solutions',
    candidateId: 'usr-cand-2',
    candidateName: 'Abigail Esmeralda Martínez Martínez',
    candidateRole: 'Consultora de Aseguramiento de Calidad',
    rating: 4,
    title: 'Buen ambiente y proyectos retadores de diseño',
    comment: 'Los proyectos tienen una gran calidad visual. A veces los plazos de entrega son ajustados, pero el liderazgo siempre está dispuesto a apoyar.',
    date: '2026-10-14',
    status: 'Aprobada',
    scores: {
      culture: 4.5,
      salary: 4.2,
      growth: 4.3,
      workLife: 4.0
    }
  },
  {
    _id: 'rev-3',
    companyId: 'comp-3',
    companyName: 'Banco Cuscatlán',
    candidateId: 'usr-cand-3',
    candidateName: 'Roberto Gómez',
    candidateRole: 'Analista de Sistemas Jr.',
    rating: 5,
    title: 'Gran estabilidad económica y beneficios insuperables',
    comment: 'Las prestaciones bancarias, capacitaciones institucionales y planes de carrera dentro del banco son excepcionales.',
    date: '2026-09-28',
    status: 'Aprobada',
    scores: {
      culture: 4.7,
      salary: 5.0,
      growth: 4.6,
      workLife: 4.5
    }
  }
];

export const SEED_ARTICLES = [
  {
    _id: 'art-1',
    title: 'Cómo estructurar un Currículum de Alto Impacto para Sistemas ATS en 2026',
    category: 'CV',
    readTime: '6 min de lectura',
    summary: 'Aprende las pautas esenciales del estándar profesional para que tu currículum destaque en los filtros de recursos humanos.',
    author: 'Lic. Claudia Portillo (Especialista en Talento Tech)',
    date: '2026-10-20',
    content: [
      'Más del 75% de las empresas de tecnología utilizan sistemas de seguimiento de candidatos (ATS) para filtrar aplicaciones antes de que un reclutador humano las revise.',
      '1. Formato limpio: Utiliza fuentes profesionales legibles, un diseño a una sola columna y evita tablas complejas o gráficos que confundan a los analizadores sintácticos.',
      '2. Encabezado directo: Incluye tu nombre completo, teléfono con formato válido (ej. 503-XXXX-XXXX), correo profesional y enlace a tu perfil de LinkedIn y GitHub / Portafolio.',
      '3. Sección de Habilidades Técnicas categorizadas: Agrupa por Lenguajes, Frameworks, Bases de Datos y Herramientas.',
      '4. Experiencia basada en logros: Utiliza la fórmula "Logré X medido por Y haciendo Z". Por ejemplo: "Optimicé el tiempo de carga del catálogo web en un 38% mediante lazy loading y compresión WebP".'
    ],
    keyTakeaways: [
      'Exporta siempre en formato PDF nativo o DOCX limpio.',
      'Incluye palabras clave que coincidan con los requisitos de la vacante.',
      'Limita tu extensión a 1 o 2 páginas como máximo.'
    ]
  },
  {
    _id: 'art-2',
    title: 'Dominando el Método STAR en Entrevistas de Trabajo',
    category: 'Entrevistas',
    readTime: '8 min de lectura',
    summary: 'La técnica estructurada para responder preguntas de comportamiento: Situación, Tarea, Acción y Resultado.',
    author: 'Lic. Alejandro Mendoza (Especialista en Selección y Talento)',
    date: '2026-10-16',
    content: [
      'Cuando un entrevistador te pide "Cuéntame de una ocasión en la que tuviste un conflicto con un compañero de equipo", busca evaluar tu madurez y resolución de problemas.',
      '• S - Situación: Contextualiza brevemente el proyecto, el equipo y la problemática encontrada.',
      '• T - Tarea: Define cuál era tu responsabilidad específica ante ese reto.',
      '• A - Acción: Explica con claridad qué decisiones tomaste tú personalmente, qué herramientas empleaste y cómo comunicaste la solución.',
      '• R - Resultado: Cuantifica el desenlace. ¿Qué se aprendió? ¿Cómo benefició al proyecto o a la empresa?'
    ],
    keyTakeaways: [
      'Sé honesto y destaca tu contribución individual sin desmerecer al equipo.',
      'Practica tus respuestas en voz alta cronometrando entre 90 y 120 segundos.'
    ]
  },
  {
    _id: 'art-3',
    title: 'Top 5 Habilidades Blandas más cotizadas por Empleadores en 2026',
    category: 'Habilidades',
    readTime: '5 min de lectura',
    summary: 'La automatización transforma las tareas rutinarias, haciendo que la comunicación asertiva y el pensamiento crítico sean el diferenciador.',
    author: 'Elena Salguero (HR Business Partner)',
    date: '2026-10-10',
    content: [
      'Las habilidades técnicas te consiguen la entrevista, pero las habilidades interpersonales te consiguen el puesto y aseguran tu crecimiento profesional a largo plazo.',
      '1. Comunicación asíncrona efectiva: Fundamental en equipos híbridos y remotos.',
      '2. Pensamiento crítico y resolución autónoma de problemas.',
      '3. Inteligencia emocional y adaptabilidad al cambio tecnológico acelerado.',
      '4. Colaboración multidisciplinaria y empatía hacia los usuarios finales.',
      '5. Aprendizaje continuo (Learnability) y curiosidad técnica.'
    ],
    keyTakeaways: [
      'Muestra ejemplos concretos de tus habilidades blandas en tus entrevistas.',
      'La empatía con el cliente transforma productos ordinarios en experiencias memorables.'
    ]
  },
  {
    _id: 'art-4',
    title: 'Panorama Salarial del Sector Tecnología en El Salvador 2026',
    category: 'Mercado',
    readTime: '7 min de lectura',
    summary: 'Rangos de compensación actualizados para puestos de desarrollo, diseño y aseguramiento de calidad.',
    author: 'Consejo Editorial Portal de Trabajo',
    date: '2026-10-05',
    content: [
      'El mercado tecnológico regional ha experimentado una aceleración notable gracias a la exportación de servicios de software hacia Norteamérica.',
      '• Pasantías y prácticas profesionales: $400 - $650 mensuales.',
      '• Desarrollador Junior (0 a 2 años): $1,000 - $1,600 mensuales.',
      '• Desarrollador Mid (2 a 4 años): $1,700 - $2,500 mensuales.',
      '• Desarrollador Senior / Tech Lead (5+ años): $2,800 - $4,500+ mensuales.'
    ],
    keyTakeaways: [
      'El dominio del idioma inglés puede incrementar tu compensación entre un 40% y 80%.',
      'Las certificaciones en Cloud y bases de datos tienen alta demanda.'
    ]
  }
];

export const SEED_FORUMS = [
  {
    _id: 'forum-1',
    title: '¿Qué proyectos recomiendan para un portafolio de Desarrollo Web en 2026?',
    category: 'Desarrollo de Software',
    authorId: 'usr-cand-1',
    authorName: 'Samuel Ernesto Villa Varela',
    authorRole: 'Candidato Profesional',
    createdAt: '2026-10-22',
    viewsCount: 342,
    status: 'Activo',
    content: 'Hola a todos los colegas. Estoy preparando mi portafolio para postularme a puestos de desarrollador. ¿Qué tipo de proyectos consideran que captan más la atención de los reclutadores técnicos hoy en día?',
    replies: [
      {
        id: 'rep-1',
        authorName: 'Carlos Mendoza',
        authorRole: 'Reclutador en TechCorp',
        date: '2026-10-22 17:10',
        content: 'Como reclutador técnico, te recomiendo un proyecto fullstack con autenticación real, manejo de estados limpios, arquitectura REST y MongoDB, en lugar de clones simples sin persistencia.'
      },
      {
        id: 'rep-2',
        authorName: 'Abigail Esmeralda Martínez Martínez',
        authorRole: 'Candidato / QA Specialist',
        date: '2026-10-23 09:30',
        content: '¡Totalmente de acuerdo! Añadir validaciones tanto en cliente como en servidor y una base de datos real con esquemas bien documentados hace que tu proyecto destaque al instante.'
      }
    ]
  },
  {
    _id: 'forum-2',
    title: 'Consejos para mi primera entrevista técnica de Pasantía',
    category: 'Primer Empleo & Pasantías',
    authorId: 'usr-cand-3',
    authorName: 'Mateo Rivas',
    authorRole: 'Candidato Profesional',
    createdAt: '2026-10-20',
    viewsCount: 289,
    status: 'Activo',
    content: 'Tengo mi primera entrevista técnica la próxima semana. ¿Qué suelen preguntar a nivel de conceptos fundamentales para un puesto trainee o intern?',
    replies: [
      {
        id: 'rep-3',
        authorName: 'Elena Salguero',
        authorRole: 'HR en Innova Solutions',
        date: '2026-10-21 11:40',
        content: 'Nos interesa ver tu razonamiento y cómo comunicas tus dudas. Si no sabes algo con certeza, sé honesto y explica cómo buscarías la respuesta.'
      }
    ]
  },
  {
    _id: 'forum-3',
    title: 'Salarios promedio para Diseñadores UI/UX en modalidad remota',
    category: 'Salarios y Negociación',
    authorId: 'usr-cand-4',
    authorName: 'Karla Benítez',
    authorRole: 'Candidato',
    createdAt: '2026-10-18',
    viewsCount: 512,
    status: 'Activo',
    content: 'Quisiera saber qué rangos salariales se están manejando para diseñadores de experiencia de usuario que trabajan de forma remota para clientes internacionales.',
    replies: [
      {
        id: 'rep-4',
        authorName: 'Samuel Ernesto Villa Varela',
        authorRole: 'Candidato',
        date: '2026-10-18 20:05',
        content: 'Para roles mid-level remotos con inglés fluido, los rangos oscilan entre $1,800 y $2,800 USD dependiendo de si manejas también sistemas de diseño y prototipado avanzado.'
      }
    ]
  }
];

export const SEED_MODERATION_LOGS = [
  {
    _id: 'log-1',
    date: '2026-10-24 11:20',
    adminName: 'Administrador del Sistema',
    category: 'Ofertas',
    targetId: 'job-101',
    targetName: 'Desarrollador Web JavaScript & Node.js (TechCorp)',
    action: 'Aprobado',
    reason: 'Oferta revisada y verificada conforme a las normas de salario transparente del portal.'
  },
  {
    _id: 'log-2',
    date: '2026-10-23 15:45',
    adminName: 'Administrador del Sistema',
    category: 'Empresas',
    targetId: 'comp-1',
    targetName: 'TechCorp El Salvador',
    action: 'Aprobado',
    reason: 'Empresa verificada mediante documentación legal de registro mercantil.'
  },
  {
    _id: 'log-3',
    date: '2026-10-21 09:10',
    adminName: 'Administrador del Sistema',
    category: 'Foros',
    targetId: 'forum-1',
    targetName: '¿Qué proyectos recomiendan para un portafolio de Desarrollo Web?',
    action: 'Aprobado',
    reason: 'Contenido verificado constructivo para la comunidad profesional.'
  }
];
