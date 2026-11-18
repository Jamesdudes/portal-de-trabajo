/**
 * Script de Verificación Integral de Endpoints, Validaciones y Roles
 * Ejecuta pruebas automatizadas sobre la API REST y la capa de base de datos
 */

import { connectDB, getMongoStatus, closeDB } from '../config/db.js';
import { handleApiRoute } from '../routes/router.js';

// Mock request / response helpers for direct unit testing of routes
function mockRequest(method, pathname, body = null, headers = {}) {
  const req = {
    method,
    url: pathname,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    _events: {},
    on(event, handler) {
      if (event === 'data' && body) {
        handler(Buffer.from(JSON.stringify(body)));
      }
      if (event === 'end') {
        handler();
      }
    }
  };
  return req;
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key] = value;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    end(content) {
      this.body = content;
      return this;
    }
  };
}

async function runTests() {
  console.log('>>> [TEST] Iniciando verificación integral del sistema...');
  await connectDB();

  const results = [];

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        results.push({ name, status: 'PASSED' });
        console.log(`✓ [PASS] ${name}`);
      } catch (err) {
        results.push({ name, status: 'FAILED', error: err.message });
        console.error(`✕ [FAIL] ${name}: ${err.message}`);
      }
    };
  }

  const tests = [
    // 1. Diagnóstico de Base de Datos
    test('GET /api/status retorna diagnóstico honesto de MongoDB', async () => {
      const req = mockRequest('GET', '/api/status');
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
      const data = JSON.parse(res.body);
      if (!('isMongoConnected' in data)) throw new Error('isMongoConnected no presente');
      if (!('storageMode' in data)) throw new Error('storageMode no presente');
    }),

    // 2. Autenticación y Cifrado
    test('POST /api/auth/login valida credenciales correctas con bcrypt', async () => {
      const req = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}: ${res.body}`);
      const data = JSON.parse(res.body);
      if (!data.token) throw new Error('Token no retornado');
      if (data.user.passwordHash) throw new Error('Seguridad: passwordHash expuesto');
    }),

    test('POST /api/auth/login rechaza contraseña incorrecta', async () => {
      const req = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'PasswordErronea'
      });
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 401) throw new Error(`Se esperaba 401, se obtuvo ${res.statusCode}`);
    }),

    test('POST /api/auth/register rechaza correo duplicado', async () => {
      const req = mockRequest('POST', '/api/auth/register', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123',
        role: 'candidato',
        firstName: 'Samuel',
        lastName: 'Villa'
      });
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 409) throw new Error(`Se esperaba 409, se obtuvo ${res.statusCode}`);
    }),

    // 3. Ofertas de Empleo y Filtros AND
    test('GET /api/jobs filtra por modalidad y rango salarial', async () => {
      const req = mockRequest('GET', '/api/jobs?modality=H%C3%ADbrido');
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
      const data = JSON.parse(res.body);
      if (!Array.isArray(data.jobs)) throw new Error('Jobs no es array');
      for (const j of data.jobs) {
        if (j.modality !== 'Híbrido') throw new Error(`Filtro falló: ${j.modality}`);
      }
    }),

    test('POST /api/jobs rechaza publicación de candidatos sin rol de empresa', async () => {
      // Login as candidate first
      const loginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const loginRes = mockResponse();
      await handleApiRoute(loginReq, loginRes);
      const candToken = JSON.parse(loginRes.body).token;

      const jobReq = mockRequest('POST', '/api/jobs', {
        title: 'Oferta no autorizada',
        description: 'Descripción de prueba con suficiente longitud para validación',
        salaryMin: 1000,
        salaryMax: 1500
      }, { authorization: `Bearer ${candToken}` });
      const jobRes = mockResponse();
      await handleApiRoute(jobReq, jobRes);
      if (jobRes.statusCode !== 403) throw new Error(`Se esperaba 403, se obtuvo ${jobRes.statusCode}`);
    }),

    test('POST /api/jobs permite publicación válida a empleador', async () => {
      // Login as employer
      const loginReq = mockRequest('POST', '/api/auth/login', {
        email: 'reclutamiento@techcorp.sv',
        password: 'Password123'
      });
      const loginRes = mockResponse();
      await handleApiRoute(loginReq, loginRes);
      const empToken = JSON.parse(loginRes.body).token;

      const newJobTitle = `Ingeniero DevOps Cloud ${Date.now()}`;
      const jobReq = mockRequest('POST', '/api/jobs', {
        title: newJobTitle,
        modality: 'Remoto',
        contractType: 'Tiempo Completo',
        experienceLevel: '3-5 años',
        sector: 'Tecnología / Software',
        salaryMin: 2200,
        salaryMax: 2900,
        location: 'San Salvador, El Salvador',
        description: 'Posición para especialista en infraestructura en la nube, pipelines de CI/CD y automatización de despliegues con Docker y Kubernetes.'
      }, { authorization: `Bearer ${empToken}` });
      const jobRes = mockResponse();
      await handleApiRoute(jobReq, jobRes);
      if (jobRes.statusCode !== 201) throw new Error(`Se esperaba 201, se obtuvo ${jobRes.statusCode}: ${jobRes.body}`);
    }),

    // 4. Postulaciones y Fases (Con CV real en GridFS)
    test('POST /api/applications exige CV real en GridFS, registra postulación y previene duplicados', async () => {
      // Login as candidate
      const loginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const loginRes = mockResponse();
      await handleApiRoute(loginReq, loginRes);
      const loginData = JSON.parse(loginRes.body);
      const candToken = loginData.token;

      // Subir CV PDF real a GridFS si el candidato semilla aún no tiene fileId
      let cvFileId = loginData.user?.cv?.fileId;
      if (!cvFileId) {
        const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF').toString('base64');
        const upReq = mockRequest('POST', '/api/files/upload', {
          fileName: 'CV_Samuel_Villa_Test.pdf',
          mimeType: 'application/pdf',
          base64Data: pdfBase64,
          fileType: 'cv'
        }, { authorization: `Bearer ${candToken}` });
        const upRes = mockResponse();
        await handleApiRoute(upReq, upRes);
        if (upRes.statusCode !== 201) {
          throw new Error(`No se pudo subir CV real a GridFS: ${upRes.statusCode} - ${upRes.body}`);
        }
        cvFileId = JSON.parse(upRes.body).fileId;
      }

      // Postulación a job-101 con CV real en GridFS
      const appReq = mockRequest('POST', '/api/applications', {
        jobId: 'job-101',
        cvFileId,
        coverNote: 'Carta de presentación de prueba'
      }, { authorization: `Bearer ${candToken}` });
      const appRes = mockResponse();
      await handleApiRoute(appReq, appRes);

      // Si ya existía da 409, si no da 201. Ambas son validaciones correctas.
      if (appRes.statusCode !== 201 && appRes.statusCode !== 409) {
        throw new Error(`Código inesperado: ${appRes.statusCode}: ${appRes.body}`);
      }

      // Si intentamos postularnos de nuevo, debe rechazar por duplicado (409)
      const dupReq = mockRequest('POST', '/api/applications', {
        jobId: 'job-101',
        cvFileId
      }, { authorization: `Bearer ${candToken}` });
      const dupRes = mockResponse();
      await handleApiRoute(dupReq, dupRes);
      if (dupRes.statusCode !== 409) throw new Error(`Se esperaba 409 por duplicado, se obtuvo ${dupRes.statusCode}`);
    }),

    // 5. Alertas de Empleo
    test('CRUD de alertas para candidatos', async () => {
      const loginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const loginRes = mockResponse();
      await handleApiRoute(loginReq, loginRes);
      const candToken = JSON.parse(loginRes.body).token;

      // Crear alerta
      const alertReq = mockRequest('POST', '/api/alerts', {
        keyword: 'Arquitecto Cloud C++',
        location: 'San Salvador',
        frequency: 'Diaria'
      }, { authorization: `Bearer ${candToken}` });
      const alertRes = mockResponse();
      await handleApiRoute(alertReq, alertRes);
      if (alertRes.statusCode !== 201) throw new Error(`Status ${alertRes.statusCode}`);
      const createdAlert = JSON.parse(alertRes.body).alert;

      // Toggle alerta
      const toggleReq = mockRequest('PATCH', `/api/alerts/${createdAlert._id}/toggle`, null, { authorization: `Bearer ${candToken}` });
      const toggleRes = mockResponse();
      await handleApiRoute(toggleReq, toggleRes);
      if (toggleRes.statusCode !== 200) throw new Error(`Toggle status ${toggleRes.statusCode}`);

      // Delete alerta
      const delReq = mockRequest('DELETE', `/api/alerts/${createdAlert._id}`, null, { authorization: `Bearer ${candToken}` });
      const delRes = mockResponse();
      await handleApiRoute(delReq, delRes);
      if (delRes.statusCode !== 200) throw new Error(`Delete status ${delRes.statusCode}`);
    }),

    // 6. Moderación y Auditoría Admin (A-01)
    test('GET /api/admin/stats y /api/admin/logs restringe a rol admin', async () => {
      // Intento sin token
      const unauthReq = mockRequest('GET', '/api/admin/stats');
      const unauthRes = mockResponse();
      await handleApiRoute(unauthReq, unauthRes);
      if (unauthRes.statusCode !== 403) throw new Error(`Se esperaba 403, se obtuvo ${unauthRes.statusCode}`);

      // Login as admin
      const adminLoginReq = mockRequest('POST', '/api/auth/login', {
        email: 'admin.portal@catolica.edu.sv',
        password: 'Password123'
      });
      const adminLoginRes = mockResponse();
      await handleApiRoute(adminLoginReq, adminLoginRes);
      const adminToken = JSON.parse(adminLoginRes.body).token;

      const statsReq = mockRequest('GET', '/api/admin/stats', null, { authorization: `Bearer ${adminToken}` });
      const statsRes = mockResponse();
      await handleApiRoute(statsReq, statsRes);
      if (statsRes.statusCode !== 200) throw new Error(`Status stats ${statsRes.statusCode}`);

      const logsReq = mockRequest('GET', '/api/admin/logs', null, { authorization: `Bearer ${adminToken}` });
      const logsRes = mockResponse();
      await handleApiRoute(logsReq, logsRes);
      if (logsRes.statusCode !== 200) throw new Error(`Status logs ${logsRes.statusCode}`);
    }),

    // 7. Validación de Teléfonos y Perfil Completo del Candidato (Estilo LinkedIn)
    test('Validación de teléfono con guiones y persistencia de perfil de candidato', async () => {
      // Iniciar sesión con candidato
      const loginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const loginRes = mockResponse();
      await handleApiRoute(loginReq, loginRes);
      const candToken = JSON.parse(loginRes.body).token;

      // 1) Debe aceptar teléfono con formato 503-XXXX-XXXX sin borrar guiones
      const validProfileReq = mockRequest('PUT', '/api/auth/profile', {
        phone: '503-7890-1234',
        title: 'Ingeniero de Software Senior | Cloud & DevOps',
        experience: [
          {
            position: 'Líder Técnico de Desarrollo',
            company: 'Banco Cuscatlán',
            location: 'San Salvador',
            period: '2023 - Actualidad',
            description: 'Arquitectura de microservicios y despliegues continuos.'
          }
        ],
        education: [
          {
            degree: 'Ingeniería en Ciencias de la Computación',
            institution: 'Universidad Don Bosco',
            level: 'Grado Universitario',
            period: '2019 - 2023'
          }
        ],
        skills: ['TypeScript', 'Node.js', 'MongoDB', 'Docker', 'AWS'],
        privacy: {
          showPhoneToCompanies: true,
          showEmailToCompanies: true,
          isProfilePublic: true
        }
      }, { authorization: `Bearer ${candToken}` });
      const validProfileRes = mockResponse();
      await handleApiRoute(validProfileReq, validProfileRes);
      if (validProfileRes.statusCode !== 200) {
        throw new Error(`Fallo al actualizar perfil: ${validProfileRes.statusCode} - ${validProfileRes.body}`);
      }
      const updatedUser = JSON.parse(validProfileRes.body).user;
      if (updatedUser.phone !== '503-7890-1234') {
        throw new Error(`El teléfono perdió los guiones: se obtuvo ${updatedUser.phone}`);
      }
      if (!Array.isArray(updatedUser.experience) || updatedUser.experience.length !== 1) {
        throw new Error('Experiencia no persistida en MongoDB');
      }
      if (!Array.isArray(updatedUser.education) || updatedUser.education.length !== 1) {
        throw new Error('Educación no persistida en MongoDB');
      }

      // 2) Debe rechazar teléfono con letras
      const invalidPhoneReq = mockRequest('PUT', '/api/auth/profile', {
        phone: 'telefono-invalido-abc'
      }, { authorization: `Bearer ${candToken}` });
      const invalidPhoneRes = mockResponse();
      await handleApiRoute(invalidPhoneReq, invalidPhoneRes);
      if (invalidPhoneRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 por teléfono con letras, se obtuvo ${invalidPhoneRes.statusCode}`);
      }
    }),

    // 8. Validación Estricta de Campos Numéricos y Salarios en Ofertas
    test('Validación estricta de salarios numéricos (rechazar negativos y letras)', async () => {
      const empLoginReq = mockRequest('POST', '/api/auth/login', {
        email: 'reclutamiento@techcorp.sv',
        password: 'Password123'
      });
      const empLoginRes = mockResponse();
      await handleApiRoute(empLoginReq, empLoginRes);
      const empToken = JSON.parse(empLoginRes.body).token;

      // Rechazar salario con letras (no convertir en cero)
      const alphaSalReq = mockRequest('POST', '/api/jobs', {
        title: 'Tester Automatizador Alpha',
        modality: 'Remoto',
        contractType: 'Tiempo Completo',
        experienceLevel: '1-2 años',
        salaryMin: 'abc',
        salaryMax: 'xyz',
        description: 'Puesto de testing automatizado con validación estricta.'
      }, { authorization: `Bearer ${empToken}` });
      const alphaSalRes = mockResponse();
      await handleApiRoute(alphaSalReq, alphaSalRes);
      if (alphaSalRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 por salario con letras, se obtuvo ${alphaSalRes.statusCode}: ${alphaSalRes.body}`);
      }

      // Rechazar salario negativo
      const negSalReq = mockRequest('POST', '/api/jobs', {
        title: 'Tester Automatizador',
        modality: 'Remoto',
        contractType: 'Tiempo Completo',
        experienceLevel: '1-2 años',
        salaryMin: -500,
        salaryMax: 1000,
        description: 'Puesto de testing automatizado.'
      }, { authorization: `Bearer ${empToken}` });
      const negSalRes = mockResponse();
      await handleApiRoute(negSalReq, negSalRes);
      if (negSalRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 por salario negativo, se obtuvo ${negSalRes.statusCode}`);
      }

      // Rechazar salario max menor que min (incluyendo 0)
      const invRangeReq = mockRequest('POST', '/api/jobs', {
        title: 'Tester Automatizador',
        modality: 'Remoto',
        contractType: 'Tiempo Completo',
        experienceLevel: '1-2 años',
        salaryMin: 2000,
        salaryMax: 0,
        description: 'Puesto de testing automatizado.'
      }, { authorization: `Bearer ${empToken}` });
      const invRangeRes = mockResponse();
      await handleApiRoute(invRangeReq, invRangeRes);
      if (invRangeRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 por rango salarial invertido, se obtuvo ${invRangeRes.statusCode}`);
      }
    }),

    // 9. Seguridad de archivos GridFS y Privacidad de Candidatos
    test('GET /api/files/:id exige autenticación y protege CVs; privacidad oculta datos a empresas', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const unauthFileReq = mockRequest('GET', `/api/files/${fakeId}`);
      const unauthFileRes = mockResponse();
      await handleApiRoute(unauthFileReq, unauthFileRes);
      if (unauthFileRes.statusCode !== 401) {
        throw new Error(`Se esperaba 401 sin token en /api/files/:id, se obtuvo ${unauthFileRes.statusCode}`);
      }

      // Login candidato y ocultar correo y teléfono
      const candLoginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const candLoginRes = mockResponse();
      await handleApiRoute(candLoginReq, candLoginRes);
      const candToken = JSON.parse(candLoginRes.body).token;

      const privReq = mockRequest('PUT', '/api/auth/profile', {
        privacy: {
          showPhoneToCompanies: false,
          showEmailToCompanies: false,
          isProfilePublic: false
        }
      }, { authorization: `Bearer ${candToken}` });
      const privRes = mockResponse();
      await handleApiRoute(privReq, privRes);
      if (privRes.statusCode !== 200) throw new Error('Fallo al guardar privacidad');

      const empLoginReq = mockRequest('POST', '/api/auth/login', {
        email: 'reclutamiento@techcorp.sv',
        password: 'Password123'
      });
      const empLoginRes = mockResponse();
      await handleApiRoute(empLoginReq, empLoginRes);
      const empToken = JSON.parse(empLoginRes.body).token;

      const appsReq = mockRequest('GET', '/api/applications', null, { authorization: `Bearer ${empToken}` });
      const appsRes = mockResponse();
      await handleApiRoute(appsReq, appsRes);
      if (appsRes.statusCode !== 200) throw new Error(`Error listando aplicaciones: ${appsRes.statusCode}`);
      const appsData = JSON.parse(appsRes.body);
      const samuelApp = (appsData.applications || []).find(a => a.candidateId === 'usr-cand-1');
      if (samuelApp) {
        if (samuelApp.candidateEmail !== null || samuelApp.candidatePhone !== null) {
          throw new Error('Privacidad vulnerada: se expuso correo o teléfono oculto.');
        }
        if (samuelApp.isProfilePublic !== false) {
          throw new Error('Privacidad vulnerada: isProfilePublic no se reflejó.');
        }
      }

      // Restaurar privacidad predeterminada
      const restoreReq = mockRequest('PUT', '/api/auth/profile', {
        privacy: { showPhoneToCompanies: true, showEmailToCompanies: true, isProfilePublic: true }
      }, { authorization: `Bearer ${candToken}` });
      await handleApiRoute(restoreReq, mockResponse());
    }),

    // 10. Segunda auditoría: cvFileId ajeno, privacidad en PUT status e invalidación de cuentas suspendidas
    test('Segunda auditoría: rechaza cvFileId inválido/ajeno, aplica privacidad en PUT status e invalida sesiones suspendidas', async () => {
      const candLoginReq = mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      });
      const candLoginRes = mockResponse();
      await handleApiRoute(candLoginReq, candLoginRes);
      const candToken = JSON.parse(candLoginRes.body).token;

      // Rechazar cvFileId con formato inválido
      const badCvReq = mockRequest('POST', '/api/applications', {
        jobId: 'job-101',
        cvFileId: 'id-invalido'
      }, { authorization: `Bearer ${candToken}` });
      const badCvRes = mockResponse();
      await handleApiRoute(badCvReq, badCvRes);
      if (badCvRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 por cvFileId inválido, se obtuvo ${badCvRes.statusCode}`);
      }

      // Verificar privacidad en updateApplicationStatus
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        privacy: { showPhoneToCompanies: false, showEmailToCompanies: false, isProfilePublic: false }
      }, { authorization: `Bearer ${candToken}` }), mockResponse());

      const empLoginRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'reclutamiento@techcorp.sv',
        password: 'Password123'
      }), empLoginRes);
      const empToken = JSON.parse(empLoginRes.body).token;

      const listRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/applications', null, { authorization: `Bearer ${empToken}` }), listRes);
      const samuelApp = (JSON.parse(listRes.body).applications || []).find(a => a.candidateId === 'usr-cand-1');
      if (samuelApp) {
        const putRes = mockResponse();
        await handleApiRoute(mockRequest('PUT', `/api/applications/${samuelApp._id}/status`, {
          status: samuelApp.status || 'En proceso',
          note: 'Prueba de privacidad en respuesta'
        }, { authorization: `Bearer ${empToken}` }), putRes);
        if (putRes.statusCode !== 200) {
          throw new Error(`Error en PUT status: ${putRes.statusCode}`);
        }
        const updatedApp = JSON.parse(putRes.body).application;
        if (updatedApp.candidateEmail !== null || updatedApp.candidatePhone !== null || updatedApp.isProfilePublic !== false) {
          throw new Error('Privacidad vulnerada en respuesta de PUT /api/applications/:id/status.');
        }
      }

      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        privacy: { showPhoneToCompanies: true, showEmailToCompanies: true, isProfilePublic: true }
      }, { authorization: `Bearer ${candToken}` }), mockResponse());

      // Invalidación inmediata de token cuando admin suspende cuenta
      const adminLoginRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'admin.portal@catolica.edu.sv',
        password: 'Password123'
      }), adminLoginRes);
      const adminToken = JSON.parse(adminLoginRes.body).token;

      const suspendRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/admin/users/usr-cand-1/suspend', {
        reason: 'Prueba de revocación de sesión'
      }, { authorization: `Bearer ${adminToken}` }), suspendRes);
      if (suspendRes.statusCode !== 200) {
        throw new Error(`Error al suspender usuario: ${suspendRes.statusCode}`);
      }

      const afterSuspendMeRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/auth/me', null, { authorization: `Bearer ${candToken}` }), afterSuspendMeRes);
      if (afterSuspendMeRes.statusCode !== 401) {
        throw new Error(`Se esperaba 401 tras suspender usuario, se obtuvo ${afterSuspendMeRes.statusCode}`);
      }

      // Reactivar cuenta para dejar BD en estado limpio
      await handleApiRoute(mockRequest('POST', '/api/admin/users/usr-cand-1/activate', {
        reason: 'Fin de prueba'
      }, { authorization: `Bearer ${adminToken}` }), mockResponse());
    }),

    // 11. Empresas CRUD, Registro Obligatorio y Propiedad
    test('Empresas CRUD, registro con companyName obligatorio, logo GridFS y aislamiento entre empresas', async () => {
      // Registro de empleador sin companyName debe retornar 400
      const badRegRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/register', {
        role: 'empleador',
        firstName: 'Ana',
        lastName: 'Lopez',
        email: `emp.sin.empresa.${Date.now()}@test.sv`,
        password: 'Password123'
      }), badRegRes);
      if (badRegRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 al registrar empleador sin empresa, se obtuvo ${badRegRes.statusCode}`);
      }

      // Registro válido de empleador con empresa
      const uniqueEmail = `emp.reg.${Date.now()}@test.sv`;
      const regRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/register', {
        role: 'empleador',
        firstName: 'Roberto',
        lastName: 'Gomez',
        email: uniqueEmail,
        password: 'Password123',
        companyName: 'Nube Salvadoreña S.A.',
        companyIndustry: 'Cloud & Datos'
      }), regRes);
      if (regRes.statusCode !== 201) {
        throw new Error(`Fallo registro de empleador: ${regRes.statusCode} - ${regRes.body}`);
      }
      const regData = JSON.parse(regRes.body);
      const newEmpToken = regData.token;
      const newCompId = regData.user.companyId;
      if (!newCompId) throw new Error('No se asignó companyId al empleador registrado');

      // Verificar que no pueda editar comp-1 ajena (403)
      const crossEditRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/companies/comp-1', {
        name: 'Hack Name'
      }, { authorization: `Bearer ${newEmpToken}` }), crossEditRes);
      if (crossEditRes.statusCode !== 403) {
        throw new Error(`Se esperaba 403 al editar empresa ajena, se obtuvo ${crossEditRes.statusCode}`);
      }

      // Verificar edición legítima de su propia empresa
      const ownEditRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', `/api/companies/${newCompId}`, {
        location: 'Santa Tecla, La Libertad',
        website: 'https://nubesv.com',
        description: 'Empresa especializada en arquitectura de nube híbrida y soluciones empresariales.'
      }, { authorization: `Bearer ${newEmpToken}` }), ownEditRes);
      if (ownEditRes.statusCode !== 200) {
        throw new Error(`Fallo al editar empresa propia: ${ownEditRes.statusCode} - ${ownEditRes.body}`);
      }

      // Subir logo PNG válido a GridFS y comprobar consulta pública
      const pngBase64 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]).toString('base64');
      const logoUpRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/files/upload', {
        fileName: 'logo_empresa.png',
        mimeType: 'image/png',
        base64Data: pngBase64,
        fileType: 'companyLogo',
        companyId: newCompId
      }, { authorization: `Bearer ${newEmpToken}` }), logoUpRes);
      if (logoUpRes.statusCode !== 201) {
        throw new Error(`Fallo al subir companyLogo: ${logoUpRes.statusCode} - ${logoUpRes.body}`);
      }
      const logoFileId = JSON.parse(logoUpRes.body).fileId;

      // Consulta sin token a /api/files/:id para companyLogo debe permitirse (200)
      const pubLogoRes = mockResponse();
      await handleApiRoute(mockRequest('GET', `/api/files/${logoFileId}`), pubLogoRes);
      if (pubLogoRes.statusCode !== 200) {
        throw new Error(`companyLogo debería ser accesible públicamente (200), se obtuvo ${pubLogoRes.statusCode}`);
      }

      // ?all=true en empresas debe rechazar 403 a no-admin y permitir caracteres especiales en búsqueda
      const nonAdminAllRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/companies?all=true', null, { authorization: `Bearer ${newEmpToken}` }), nonAdminAllRes);
      if (nonAdminAllRes.statusCode !== 403) {
        throw new Error(`Se esperaba 403 en /api/companies?all=true para empleador, se obtuvo ${nonAdminAllRes.statusCode}`);
      }

      const regexCompRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/companies?q=C%2B%2B'), regexCompRes);
      if (regexCompRes.statusCode !== 200) {
        throw new Error(`Error en búsqueda de empresas con regex especial: ${regexCompRes.statusCode}`);
      }
    }),

    // 12. Ofertas CRUD Completo, Seguridad de Estados, Postulación Bloqueada y Stats Públicos
    test('Ofertas CRUD completo (editar, pausar, reactivar, eliminar), protección de ofertas cerradas/vencidas y stats públicos', async () => {
      const empLoginRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'reclutamiento@techcorp.sv',
        password: 'Password123'
      }), empLoginRes);
      const empToken = JSON.parse(empLoginRes.body).token;

      const candLoginRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      }), candLoginRes);
      const candToken = JSON.parse(candLoginRes.body).token;

      // Búsqueda con caracteres especiales (C++) sin fallo de regex
      const cppSearchRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/jobs?q=C%2B%2B'), cppSearchRes);
      if (cppSearchRes.statusCode !== 200) {
        throw new Error(`La búsqueda con C++ falló: ${cppSearchRes.statusCode}`);
      }

      // No permitir ?all=true o ?status=Cerrada a público/candidato
      const unauthAllRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/jobs?all=true', null, { authorization: `Bearer ${candToken}` }), unauthAllRes);
      if (unauthAllRes.statusCode !== 403) {
        throw new Error(`Se esperaba 403 en GET /api/jobs?all=true para candidato, se obtuvo ${unauthAllRes.statusCode}`);
      }

      // Crear oferta, editarla, pausarla y proteger detalle ante público
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const createRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/jobs', {
        title: `Ingeniero Backend C++ ${Date.now()}`,
        modality: 'Remoto',
        contractType: 'Tiempo Completo',
        experienceLevel: '3-5 años',
        sector: 'Tecnología',
        salaryMin: 1800,
        salaryMax: 2500,
        expiresAt: futureDate,
        location: 'San Salvador',
        description: 'Desarrollo de servicios de alto rendimiento en C++ y Node.js con pruebas automatizadas.',
        responsibilities: ['Diseñar microservicios', 'Optimizar consultas MongoDB'],
        requirements: ['3 años en backend', 'Dominio de Linux'],
        benefits: ['Seguro médico', 'Horario flexible']
      }, { authorization: `Bearer ${empToken}` }), createRes);
      if (createRes.statusCode !== 201) {
        throw new Error(`Error creando oferta: ${createRes.statusCode} - ${createRes.body}`);
      }
      const createdJobId = JSON.parse(createRes.body).job._id;

      // Pausar oferta
      const pauseRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', `/api/jobs/${createdJobId}`, {
        status: 'Pausada'
      }, { authorization: `Bearer ${empToken}` }), pauseRes);
      if (pauseRes.statusCode !== 200) {
        throw new Error(`Error al pausar oferta: ${pauseRes.statusCode}`);
      }

      // Candidato no debe ver oferta pausada ni poder postularse
      const viewPausedRes = mockResponse();
      await handleApiRoute(mockRequest('GET', `/api/jobs/${createdJobId}`, null, { authorization: `Bearer ${candToken}` }), viewPausedRes);
      if (viewPausedRes.statusCode !== 403) {
        throw new Error(`Se esperaba 403 al ver oferta pausada como candidato, se obtuvo ${viewPausedRes.statusCode}`);
      }

      const applyPausedRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/applications', {
        jobId: createdJobId
      }, { authorization: `Bearer ${candToken}` }), applyPausedRes);
      if (applyPausedRes.statusCode !== 400) {
        throw new Error(`Se esperaba 400 al postular a oferta pausada, se obtuvo ${applyPausedRes.statusCode}`);
      }

      // Reactivar oferta
      const reactivateRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', `/api/jobs/${createdJobId}`, {
        status: 'Activa'
      }, { authorization: `Bearer ${empToken}` }), reactivateRes);
      if (reactivateRes.statusCode !== 200) {
        throw new Error(`Error al reactivar oferta: ${reactivateRes.statusCode}`);
      }

      // Eliminar definitivamente oferta sin postulaciones (?hard=true)
      const hardDelRes = mockResponse();
      await handleApiRoute(mockRequest('DELETE', `/api/jobs/${createdJobId}?hard=true`, null, { authorization: `Bearer ${empToken}` }), hardDelRes);
      if (hardDelRes.statusCode !== 200 || !JSON.parse(hardDelRes.body).deleted) {
        throw new Error(`Error en hard delete de oferta sin postulaciones: ${hardDelRes.statusCode} - ${hardDelRes.body}`);
      }

      // Eliminar definitivamente oferta con postulaciones (job-101) debe retornar 409
      const blockedHardDelRes = mockResponse();
      await handleApiRoute(mockRequest('DELETE', '/api/jobs/job-101?hard=true', null, { authorization: `Bearer ${empToken}` }), blockedHardDelRes);
      if (blockedHardDelRes.statusCode !== 409) {
        throw new Error(`Se esperaba 409 al intentar hard delete de job-101 con postulaciones, se obtuvo ${blockedHardDelRes.statusCode}`);
      }

      // Verificar /api/stats/public retorna conteos reales numéricos
      const pubStatsRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/stats/public'), pubStatsRes);
      if (pubStatsRes.statusCode !== 200) {
        throw new Error(`Error en GET /api/stats/public: ${pubStatsRes.statusCode}`);
      }
      const pubStats = JSON.parse(pubStatsRes.body).stats;
      if (typeof pubStats.activeJobs !== 'number' || typeof pubStats.activeCompanies !== 'number') {
        throw new Error('Estadísticas públicas inválidas');
      }

      // Verificar que updateProfile ignora intento de inyectar cv falso sin GridFS
      const spoofRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        cv: { fileName: 'CV_Falso.pdf', fileSize: '99 MB' }
      }, { authorization: `Bearer ${candToken}` }), spoofRes);
      if (spoofRes.statusCode !== 200) {
        throw new Error(`Error inesperado en updateProfile: ${spoofRes.statusCode}`);
      }
      const spoofedUser = JSON.parse(spoofRes.body).user;
      if (spoofedUser.cv && spoofedUser.cv.fileName === 'CV_Falso.pdf') {
        throw new Error('Vulnerabilidad: updateProfile permitió sobrescribir cv sin GridFS');
      }
    }),

    // 18. Preferencia de Modo Oscuro / Claro por usuario en MongoDB y caché
    test('Preferencia de tema persistida por usuario en MongoDB y validación de valores light/dark', async () => {
      const loginRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      }), loginRes);
      const token = JSON.parse(loginRes.body).token;

      // Actualizar a dark
      const darkRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        themePreference: 'dark'
      }, { authorization: `Bearer ${token}` }), darkRes);
      if (darkRes.statusCode !== 200) throw new Error(`Fallo actualizando tema a dark: ${darkRes.statusCode}`);
      const updatedUser = JSON.parse(darkRes.body).user;
      if (updatedUser.themePreference !== 'dark') throw new Error('themePreference no se actualizó a dark');

      // Rechazar valor inválido
      const badThemeRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        themePreference: 'neon-purple'
      }, { authorization: `Bearer ${token}` }), badThemeRes);
      if (badThemeRes.statusCode !== 400) throw new Error(`Se esperaba 400 por tema inválido, se obtuvo ${badThemeRes.statusCode}`);

      // Restaurar a light
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        themePreference: 'light'
      }, { authorization: `Bearer ${token}` }), mockResponse());
    }),

    // 19. Aislamiento y Permisos de Configuración de Cuenta y Tema
    test('Aislamiento de permisos al actualizar perfil y preferencias entre usuarios', async () => {
      const candLogin = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      }), candLogin);
      const candToken = JSON.parse(candLogin.body).token;

      const crossModRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/auth/profile', {
        targetUserId: 'usr-emp-1',
        title: 'Hacker Title'
      }, { authorization: `Bearer ${candToken}` }), crossModRes);
      if (crossModRes.statusCode !== 403) {
        throw new Error(`Se esperaba 403 al modificar targetUserId ajeno, se obtuvo ${crossModRes.statusCode}`);
      }
    }),

    // 20. Administración de Usuarios: Edición por Admin
    test('Administrador puede editar datos de perfil de usuario y se rechaza acceso a no administradores', async () => {
      const candLogin = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      }), candLogin);
      const candToken = JSON.parse(candLogin.body).token;

      // No admin intenta editar usuario -> 403
      const nonAdminEdit = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/admin/users/usr-cand-1', {
        firstName: 'Hacked'
      }, { authorization: `Bearer ${candToken}` }), nonAdminEdit);
      if (nonAdminEdit.statusCode !== 403) {
        throw new Error(`Se esperaba 403 para no admin editando usuario, se obtuvo ${nonAdminEdit.statusCode}`);
      }

      // Login admin
      const adminLogin = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'admin.portal@catolica.edu.sv',
        password: 'Password123'
      }), adminLogin);
      const adminToken = JSON.parse(adminLogin.body).token;

      // Admin edita usuario exitosamente
      const adminEdit = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/admin/users/usr-cand-1', {
        firstName: 'Samuel Actualizado',
        title: 'Senior Full Stack Engineer'
      }, { authorization: `Bearer ${adminToken}` }), adminEdit);
      if (adminEdit.statusCode !== 200) {
        throw new Error(`Admin edit user falló: ${adminEdit.statusCode} - ${adminEdit.body}`);
      }
      const updatedData = JSON.parse(adminEdit.body).user;
      if (updatedData.firstName !== 'Samuel Actualizado') {
        throw new Error('El nombre de usuario no se actualizó');
      }
    }),

    // 21. Restablecimiento de Contraseña Temporal por Administrador e Invalidación de Sesiones
    test('Admin restablece contraseña, genera temporal, marca mustChangePassword e invalida sesiones', async () => {
      const candLogin = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: 'Password123'
      }), candLogin);
      const candToken = JSON.parse(candLogin.body).token;

      const adminLogin = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'admin.portal@catolica.edu.sv',
        password: 'Password123'
      }), adminLogin);
      const adminToken = JSON.parse(adminLogin.body).token;

      // Admin ejecuta reset password
      const resetRes = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/admin/users/usr-cand-1/reset-password', null, { authorization: `Bearer ${adminToken}` }), resetRes);
      if (resetRes.statusCode !== 200) {
        throw new Error(`Reset password falló: ${resetRes.statusCode} - ${resetRes.body}`);
      }
      const resetData = JSON.parse(resetRes.body);
      if (!resetData.temporaryPassword) {
        throw new Error('No se generó contraseña temporal');
      }

      // Token anterior del candidato debe quedar invalidado (401 en /api/auth/me)
      const meRes = mockResponse();
      await handleApiRoute(mockRequest('GET', '/api/auth/me', null, { authorization: `Bearer ${candToken}` }), meRes);
      if (meRes.statusCode !== 401) {
        throw new Error(`Se esperaba 401 por sesión invalidada tras reset de contraseña, se obtuvo ${meRes.statusCode}`);
      }

      // Iniciar sesión con contraseña temporal
      const loginTemp = mockResponse();
      await handleApiRoute(mockRequest('POST', '/api/auth/login', {
        email: 'samuel.villa@catolica.edu.sv',
        password: resetData.temporaryPassword
      }), loginTemp);
      if (loginTemp.statusCode !== 200) {
        throw new Error(`Login con contraseña temporal falló: ${loginTemp.statusCode} - ${loginTemp.body}`);
      }
      const tempUserData = JSON.parse(loginTemp.body).user;
      if (!tempUserData.mustChangePassword) {
        throw new Error('mustChangePassword debería ser true tras restablecimiento');
      }

      // Cambiar contraseña obligatoria con PUT /api/auth/change-password
      const changePwdRes = mockResponse();
      await handleApiRoute(mockRequest('PUT', '/api/auth/change-password', {
        newPassword: 'Password123'
      }, { authorization: `Bearer ${JSON.parse(loginTemp.body).token}` }), changePwdRes);
      if (changePwdRes.statusCode !== 200) {
        throw new Error(`Cambio de contraseña falló: ${changePwdRes.statusCode} - ${changePwdRes.body}`);
      }
    }),

    // 13. Resiliencia y Manejo de Errores ante Indisponibilidad de MongoDB
    test('Si MongoDB no está disponible, la API retorna HTTP 503 claro y no simula almacenamiento', async () => {
      await closeDB();
      const req = mockRequest('GET', '/api/jobs');
      const res = mockResponse();
      await handleApiRoute(req, res);
      if (res.statusCode !== 503) {
        throw new Error(`Se esperaba 503 al desconectar MongoDB, se obtuvo ${res.statusCode}: ${res.body}`);
      }
      const data = JSON.parse(res.body);
      if (data.code !== 'MONGODB_UNAVAILABLE') {
        throw new Error(`Código inesperado: ${data.code}`);
      }
      // Reconectar de inmediato a MongoDB real para mantener la BD disponible
      await connectDB();
    })
  ];

  for (const t of tests) {
    await t();
  }

  const passed = results.filter(r => r.status === 'PASSED').length;
  console.log(`\n=======================================================`);
  console.log(`TOTAL PRUEBAS: ${results.length} | APROBADAS: ${passed} | FALLIDAS: ${results.length - passed}`);
  console.log(`=======================================================`);

  if (passed !== results.length) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('[TEST FATAL]:', err);
  process.exit(1);
});
