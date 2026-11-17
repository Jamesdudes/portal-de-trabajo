
import { getCollection } from '../config/db.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function respond(res, status, data) {
  res.writeHead(status, JSON_HEADERS);
  return res.end(JSON.stringify(data));
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function canManageCompany(user, company) {
  return isAdmin(user) ||
    (user?.role === 'empleador' && user.companyId === company?._id);
}


export async function listCompanies(req, res, user, query = {}) {
  try {
    const filter = { status: 'Activa' };

    if (query.industry) {
      filter.industry = { $regex: String(query.industry), $options: 'i' };
    }

    if (query.location) {
      filter.location = { $regex: String(query.location), $options: 'i' };
    }

    if (query.search) {
      const search = String(query.search);
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }

    const companies = await getCollection('companies')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return respond(res, 200, { companies, total: companies.length });
  } catch (error) {
    console.error('Error al listar empresas:', error);
    return respond(res, 500, { error: 'No se pudieron obtener las empresas.' });
  }
}


export async function getCompanyById(req, res, user, companyId) {
  try {
    const company = await getCollection('companies').findOne({ _id: companyId });

    if (!company) {
      return respond(res, 404, { error: 'Empresa no encontrada.' });
    }

    return respond(res, 200, { company });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    return respond(res, 500, { error: 'No se pudo obtener la empresa.' });
  }
}


export async function createCompany(req, res, user, body = {}) {
  try {
    if (!user || !['empleador', 'admin'].includes(user.role)) {
      return respond(res, 403, { error: 'No tienes permiso para registrar empresas.' });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (name.length < 2) {
      return respond(res, 400, { error: 'El nombre de la empresa es obligatorio.' });
    }

    if (user.role === 'empleador' && user.companyId) {
      return respond(res, 409, {
        error: 'Tu cuenta ya tiene una empresa asociada. Puedes actualizar su información.'
      });
    }

    const company = {
      _id: `comp-${Date.now()}`,
      name,
      legalName: String(body.legalName || '').trim(),
      logo: String(body.logo || '').trim(),
      industry: String(body.industry || 'No especificada').trim(),
      size: String(body.size || 'No especificado').trim(),
      location: String(body.location || '').trim(),
      website: String(body.website || '').trim(),
      description: String(body.description || '').trim(),
      verified: false,
      averageRating: 0,
      reviewCount: 0,
      status: 'Activa',
      createdAt: new Date()
    };

    await getCollection('companies').insertOne(company);

    if (user.role === 'empleador') {
      await getCollection('users').updateOne(
        { _id: user._id },
        { $set: { companyId: company._id } }
      );
    }

    return respond(res, 201, {
      message: 'Empresa registrada correctamente.',
      company
    });
  } catch (error) {
    console.error('Error al crear empresa:', error);
    return respond(res, 500, { error: 'No se pudo registrar la empresa.' });
  }
}


export async function updateCompany(req, res, user, companyId, body = {}) {
  try {
    const companies = getCollection('companies');
    const company = await companies.findOne({ _id: companyId });

    if (!company) {
      return respond(res, 404, { error: 'Empresa no encontrada.' });
    }

    if (!canManageCompany(user, company)) {
      return respond(res, 403, { error: 'No tienes permiso para modificar esta empresa.' });
    }

    const allowedFields = [
      'name', 'legalName', 'logo', 'industry', 'size',
      'location', 'website', 'description'
    ];

    const changes = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') {
          return respond(res, 400, { error: `El campo ${field} debe ser texto.` });
        }
        changes[field] = body[field].trim();
      }
    }

    if (changes.name !== undefined && changes.name.length < 2) {
      return respond(res, 400, { error: 'El nombre debe tener al menos 2 caracteres.' });
    }

    if (Object.keys(changes).length === 0) {
      return respond(res, 400, { error: 'No se enviaron datos para actualizar.' });
    }

    await companies.updateOne({ _id: companyId }, { $set: changes });

    const updatedCompany = await companies.findOne({ _id: companyId });

    return respond(res, 200, {
      message: 'Empresa actualizada correctamente.',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    return respond(res, 500, { error: 'No se pudo actualizar la empresa.' });
  }
}


export async function deleteCompany(req, res, user, companyId) {
  try {
    const companies = getCollection('companies');
    const company = await companies.findOne({ _id: companyId });

    if (!company) {
      return respond(res, 404, { error: 'Empresa no encontrada.' });
    }

    if (!isAdmin(user)) {
      return respond(res, 403, { error: 'Solo un administrador puede desactivar empresas.' });
    }

    await companies.updateOne(
      { _id: companyId },
      { $set: { status: 'Inactiva' } }
    );

    return respond(res, 200, { message: 'Empresa desactivada correctamente.' });
  } catch (error) {
    console.error('Error al desactivar empresa:', error);
    return respond(res, 500, { error: 'No se pudo desactivar la empresa.' });
  }
}
