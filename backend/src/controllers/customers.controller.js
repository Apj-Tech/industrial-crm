const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', category = '', industryType = '', status = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      isActive: true,
      AND: [
        search ? { OR: [
          { companyName: { contains: search } }, { contactPerson: { contains: search } },
          { contactNumber: { contains: search } }, { location: { contains: search } },
          { email: { contains: search } },
        ] } : {},
        category ? { category } : {},
        industryType ? { industryType } : {},
        status ? { status } : {},
      ],
    };
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: Number(limit), orderBy: { updatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { meetings: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);
    return sendPaginated(res, customers, total, page, limit, 'Customers fetched');
  } catch (err) {
    console.error('getCustomers:', err);
    return sendError(res, 'Failed to fetch customers.', 500);
  }
};

// GET /api/customers/with-location  — only customers that have GPS coordinates (for map)
const getCustomersWithLocation = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true, lat: { not: null }, lng: { not: null } },
      select: {
        id: true, companyName: true, contactPerson: true, contactNumber: true,
        lat: true, lng: true, address: true, location: true, category: true,
        status: true, geoFenceRadius: true,
        _count: { select: { meetings: true } },
      },
      orderBy: { companyName: 'asc' },
    });
    return sendSuccess(res, { customers, count: customers.length });
  } catch (err) {
    return sendError(res, 'Failed to fetch customer locations.', 500);
  }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        meetings: {
          orderBy: { meetingDate: 'desc' }, take: 20,
          include: { user: { select: { name: true } } },
        },
      },
    });
    if (!customer) return sendError(res, 'Customer not found.', 404);
    return sendSuccess(res, { customer });
  } catch (err) {
    return sendError(res, 'Failed to fetch customer.', 500);
  }
};

const createCustomer = async (req, res) => {
  try {
    const {
      companyName, contactPerson, contactNumber, designation, email, location, address,
      lat, lng, geoFenceRadius, mapsLink, category, industryType, machineDetails,
      status, remarks,
    } = req.body;
    if (!companyName || !contactPerson || !contactNumber) {
      return sendError(res, 'Company name, contact person, and number are required.', 400);
    }

    // Duplicate check
    const dup = await prisma.customer.findFirst({
      where: { companyName: { equals: companyName.trim() }, isActive: true },
    });
    if (dup) return sendError(res, `"${companyName.trim()}" already exists in the database (ID: ${dup.id}).`, 409);

    const customer = await prisma.customer.create({
      data: {
        companyName: companyName.trim(), contactPerson: contactPerson.trim(),
        contactNumber: contactNumber.trim(), designation: designation?.trim(),
        email: email?.trim().toLowerCase(), location: location?.trim(),
        address: address?.trim(),
        lat: lat !== undefined ? Number(lat) : null,
        lng: lng !== undefined ? Number(lng) : null,
        geoFenceRadius: geoFenceRadius ? Number(geoFenceRadius) : 200,
        mapsLink: mapsLink?.trim(), category: category?.trim(),
        industryType: industryType?.trim(), machineDetails, status: status || 'ACTIVE',
        remarks: remarks?.trim(), createdById: req.user.id,
      },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'CUSTOMER_CREATED', entityType: 'Customer', entityId: customer.id,
              details: JSON.stringify({ companyName }) },
    });

    return sendSuccess(res, { customer }, 'Customer added successfully', 201);
  } catch (err) {
    console.error('createCustomer:', err);
    return sendError(res, 'Failed to create customer.', 500);
  }
};

const updateCustomer = async (req, res) => {
  try {
    const {
      companyName, contactPerson, contactNumber, designation, email, location, address,
      lat, lng, geoFenceRadius, mapsLink, category, industryType, machineDetails, status, remarks,
    } = req.body;
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 'Customer not found.', 404);

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(companyName && { companyName: companyName.trim() }),
        ...(contactPerson && { contactPerson: contactPerson.trim() }),
        ...(contactNumber && { contactNumber: contactNumber.trim() }),
        ...(designation !== undefined && { designation: designation?.trim() }),
        ...(email !== undefined && { email: email?.trim().toLowerCase() }),
        ...(location !== undefined && { location: location?.trim() }),
        ...(address !== undefined && { address: address?.trim() }),
        ...(lat !== undefined && { lat: lat ? Number(lat) : null }),
        ...(lng !== undefined && { lng: lng ? Number(lng) : null }),
        ...(geoFenceRadius !== undefined && { geoFenceRadius: Number(geoFenceRadius) }),
        ...(mapsLink !== undefined && { mapsLink: mapsLink?.trim() }),
        ...(category !== undefined && { category: category?.trim() }),
        ...(industryType !== undefined && { industryType: industryType?.trim() }),
        ...(machineDetails !== undefined && { machineDetails }),
        ...(status && { status }),
        ...(remarks !== undefined && { remarks: remarks?.trim() }),
      },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'CUSTOMER_UPDATED', entityType: 'Customer', entityId: req.params.id },
    });

    return sendSuccess(res, { customer }, 'Customer updated');
  } catch (err) {
    return sendError(res, 'Failed to update customer.', 500);
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, {}, 'Customer deleted');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Customer not found.', 404);
    return sendError(res, 'Failed to delete customer.', 500);
  }
};

const getFilterMeta = async (req, res) => {
  try {
    const [categories, industries, statuses] = await Promise.all([
      prisma.customer.findMany({ where: { isActive: true, category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      prisma.customer.findMany({ where: { isActive: true, industryType: { not: null } }, select: { industryType: true }, distinct: ['industryType'] }),
      prisma.customer.findMany({ where: { isActive: true }, select: { status: true }, distinct: ['status'] }),
    ]);
    return sendSuccess(res, {
      categories: categories.map(c => c.category).filter(Boolean).sort(),
      industries: industries.map(i => i.industryType).filter(Boolean).sort(),
      statuses: statuses.map(s => s.status).filter(Boolean).sort(),
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch filter options.', 500);
  }
};

module.exports = { getCustomers, getCustomersWithLocation, getCustomer, createCustomer, updateCustomer, deleteCustomer, getFilterMeta };
