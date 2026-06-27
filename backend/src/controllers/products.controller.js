const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', category = '', categoryId = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      isActive: true,
      AND: [
        search ? { OR: [{ itemCode: { contains: search } }, { productName: { contains: search } }, { description: { contains: search } }] } : {},
        category ? { category } : {},
        categoryId ? { categoryId } : {},
      ],
    };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: Number(limit),
        orderBy: [{ categoryRef: { sortOrder: 'asc' } }, { itemCode: 'asc' }],
        include: { stock: true, categoryRef: { select: { id: true, name: true, color: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    return sendPaginated(res, products, total, page, limit, 'Products fetched');
  } catch (err) {
    console.error('getProducts:', err);
    return sendError(res, 'Failed to fetch products.', 500);
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { stock: true, categoryRef: true },
    });
    if (!product) return sendError(res, 'Product not found.', 404);
    return sendSuccess(res, { product });
  } catch (err) {
    return sendError(res, 'Failed to fetch product.', 500);
  }
};

const searchByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const product = await prisma.product.findUnique({ where: { itemCode: code }, include: { stock: true, categoryRef: true } });
    if (!product) return sendError(res, 'Item code not found.', 404);
    return sendSuccess(res, { product });
  } catch (err) {
    return sendError(res, 'Lookup failed.', 500);
  }
};

// GET /api/products/search?q=...
// AJAX autocomplete for quotation line items — matches PHP Catalog::search.
const autocomplete = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return sendSuccess(res, { results: [] });

    const results = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ itemCode: { contains: q } }, { description: { contains: q } }, { productName: { contains: q } }],
      },
      select: {
        id: true, itemCode: true, productName: true, description: true, unit: true,
        standardPrice: true, hsnCode: true, categoryId: true,
        categoryRef: { select: { name: true, color: true } },
      },
      orderBy: { itemCode: 'asc' },
      take: 15,
    });
    return sendSuccess(res, { results });
  } catch (err) {
    return sendError(res, 'Search failed.', 500);
  }
};

const createProduct = async (req, res) => {
  try {
    const { itemCode, productName, description, unit, standardPrice, category, categoryId, productRef, isCustom, drawingNumber, revisionNumber, hsnCode } = req.body;
    if (!itemCode || !productName) return sendError(res, 'Item code and product name are required.', 400);

    const exists = await prisma.product.findUnique({ where: { itemCode } });
    if (exists) return sendError(res, 'Item code already exists.', 409);

    const product = await prisma.product.create({
      data: {
        itemCode: itemCode.trim().toUpperCase(),
        productName, description, unit,
        standardPrice: Number(standardPrice || 0),
        category, categoryId: categoryId || null,
        productRef, isCustom: Boolean(isCustom),
        drawingNumber, revisionNumber, hsnCode,
      },
    });
    return sendSuccess(res, { product }, 'Product created', 201);
  } catch (err) {
    console.error('createProduct:', err);
    return sendError(res, 'Failed to create product.', 500);
  }
};

const updateProduct = async (req, res) => {
  try {
    const { productName, description, unit, standardPrice, category, categoryId, productRef, isCustom, drawingNumber, revisionNumber, hsnCode } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        productName, description, unit,
        standardPrice: standardPrice !== undefined ? Number(standardPrice) : undefined,
        category, categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
        productRef, isCustom: isCustom !== undefined ? Boolean(isCustom) : undefined,
        drawingNumber, revisionNumber, hsnCode,
      },
    });
    return sendSuccess(res, { product }, 'Product updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Product not found.', 404);
    return sendError(res, 'Failed to update product.', 500);
  }
};

module.exports = { getProducts, getProduct, searchByCode, autocomplete, createProduct, updateProduct };
