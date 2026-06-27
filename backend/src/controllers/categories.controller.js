const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');

const prisma = new PrismaClient();

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true, stock: true } } },
    });
    return sendSuccess(res, { categories });
  } catch (err) {
    return sendError(res, 'Failed to fetch categories.', 500);
  }
};

// POST /api/categories  (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return sendError(res, 'Category name is required.', 400);

    const exists = await prisma.category.findUnique({ where: { name: name.trim() } });
    if (exists) return sendError(res, `Category "${name.trim()}" already exists.`, 409);

    const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        color: color?.trim() || '#64748b',
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });
    return sendSuccess(res, { category }, 'Category added', 201);
  } catch (err) {
    return sendError(res, 'Failed to create category.', 500);
  }
};

// PUT /api/categories/:id  (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { name, color, sortOrder } = req.body;
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 'Category not found.', 404);

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color && { color: color.trim() }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });
    return sendSuccess(res, { category }, 'Category updated');
  } catch (err) {
    return sendError(res, 'Failed to update category.', 500);
  }
};

// DELETE /api/categories/:id  (Admin only)
// Guarded: refuses if any products are still assigned to this category,
// matching the PHP system's behavior.
const deleteCategory = async (req, res) => {
  try {
    const productCount = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (productCount > 0) {
      return sendError(res, `Cannot delete: ${productCount} product(s) are assigned to this category. Reassign them first.`, 400);
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    return sendSuccess(res, {}, 'Category deleted');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Category not found.', 404);
    return sendError(res, 'Failed to delete category.', 500);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
