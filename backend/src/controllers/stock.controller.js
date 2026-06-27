const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

// GET /api/products/stock — full inventory list
const getStock = async (req, res) => {
  try {
    const { page = 1, limit = 500, search = '', categoryId = '', itemGroup = '', inStockOnly = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { itemCode: { contains: search } },
          { itemName: { contains: search } },
          { itemGroup: { contains: search } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(itemGroup && { itemGroup }),
      ...(inStockOnly === 'true' && { availableStock: { gt: 0 } }),
    };

    const [stock, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          categoryRef: { select: { id: true, name: true, color: true } },
          product: { select: { id: true, itemCode: true, productName: true, unit: true } },
        },
        orderBy: [{ itemGroup: 'asc' }, { itemName: 'asc' }],
        skip, take: Number(limit),
      }),
      prisma.stock.count({ where }),
    ]);

    return sendPaginated(res, stock, total, page, limit, 'Stock fetched');
  } catch (err) {
    console.error('getStock:', err);
    return sendError(res, 'Failed to fetch stock.', 500);
  }
};

// GET /api/products/stock/alerts
const getStockAlerts = async (req, res) => {
  try {
    const stock = await prisma.stock.findMany({
      where: { isActive: true },
      include: { categoryRef: { select: { name: true, color: true } } },
    });

    const outOfStock = stock.filter((s) => s.availableStock === 0);
    const lowStock = stock.filter((s) => s.availableStock > 0 && s.availableStock <= s.minimumStock);
    const excessStock = stock.filter((s) => s.minimumStock > 0 && s.availableStock > s.minimumStock * 3);

    return sendSuccess(res, {
      outOfStock, lowStock, excessStock,
      summary: { outOfStock: outOfStock.length, lowStock: lowStock.length, excessStock: excessStock.length, total: stock.length },
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch stock alerts.', 500);
  }
};

// GET /api/products/stock/stats
const getStockStats = async (req, res) => {
  try {
    const [total, inStockCount, valueAgg, itemGroups] = await Promise.all([
      prisma.stock.count({ where: { isActive: true } }),
      prisma.stock.count({ where: { isActive: true, availableStock: { gt: 0 } } }),
      prisma.stock.findMany({ where: { isActive: true }, select: { availableStock: true, netPrice: true } }),
      prisma.stock.findMany({ where: { isActive: true, itemGroup: { not: null } }, select: { itemGroup: true }, distinct: ['itemGroup'] }),
    ]);
    const stockValue = valueAgg.reduce((sum, s) => sum + s.availableStock * s.netPrice, 0);

    return sendSuccess(res, {
      total,
      inStock: inStockCount,
      outOfStock: total - inStockCount,
      stockValue: Math.round(stockValue * 100) / 100,
      itemGroups: itemGroups.map((g) => g.itemGroup).filter(Boolean).sort(),
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch stock stats.', 500);
  }
};

// POST /api/products/stock  (Admin only) — manual add
const createStock = async (req, res) => {
  try {
    const data = parseStockBody(req.body);
    if (!data.itemCode || !data.itemName) return sendError(res, 'Item code and item name are required.', 400);

    const exists = await prisma.stock.findUnique({ where: { itemCode: data.itemCode } });
    if (exists) return sendError(res, 'An item with this code already exists.', 409);

    const stock = await prisma.stock.create({ data });
    return sendSuccess(res, { stock }, 'Stock item added', 201);
  } catch (err) {
    console.error('createStock:', err);
    return sendError(res, 'Failed to create stock item.', 500);
  }
};

// PUT /api/products/stock/:id  (Admin only) — manual edit
const updateStock = async (req, res) => {
  try {
    const data = parseStockBody(req.body);
    const stock = await prisma.stock.update({ where: { id: req.params.id }, data: { ...data, lastUpdated: new Date() } });
    return sendSuccess(res, { stock }, 'Stock item updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Stock item not found.', 404);
    return sendError(res, 'Failed to update stock item.', 500);
  }
};

// DELETE /api/products/stock/:id  (Admin only)
const deleteStock = async (req, res) => {
  try {
    await prisma.stock.delete({ where: { id: req.params.id } });
    return sendSuccess(res, {}, 'Stock item deleted');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Stock item not found.', 404);
    return sendError(res, 'Failed to delete stock item.', 500);
  }
};

function parseStockBody(b) {
  return {
    itemCode: b.itemCode ? String(b.itemCode).trim().toUpperCase() : undefined,
    itemName: b.itemName?.trim(),
    itemType: b.itemType?.trim() || 'Regular',
    productMaster: b.productMaster?.trim(),
    productFamily: b.productFamily?.trim(),
    productSubfamily: b.productSubfamily?.trim(),
    itemGroup: b.itemGroup?.trim(),
    categoryCode: b.categoryCode?.trim()?.toUpperCase(),
    categoryId: b.categoryId || null,
    availableStock: b.availableStock !== undefined ? Number(b.availableStock) : undefined,
    reservedStock: b.reservedStock !== undefined ? Number(b.reservedStock) : undefined,
    minimumStock: b.minimumStock !== undefined ? Number(b.minimumStock) : undefined,
    netPrice: b.netPrice !== undefined ? Number(b.netPrice) : undefined,
    xceedLp: b.xceedLp !== undefined ? Number(b.xceedLp) : undefined,
    edd: b.edd?.trim(),
    rad: b.rad?.trim(),
    location: b.location?.trim(),
  };
}

// GET /api/products/stock/template — downloadable Excel template
// Matches the exact 13-column layout the PHP system expects.
const downloadTemplate = async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [
      'Item Type', 'Product Master', 'Product Family', 'Product Subfamily',
      'Item Group', 'Category', 'ItemCode', 'ItemName',
      'InStock', 'NetPrice', 'Xceed-LP', 'EDD', 'RAD',
    ];
    const sample = [
      ['Regular', 'Carbide Tooling', 'Inserts', 'Turning', 'Insert', 'INS', 'CNMG120408-MF', 'CNMG 120408-MF Turning Insert', 150, 250, 310, '7-10 days', 'On confirmation'],
      ['Regular', 'Holders', 'Collet Chucks', 'ER Series', 'Holder', 'HLD', 'ER32-COLLET-12', 'ER32 Collet Chuck 12mm', 65, 1100, 1380, '7-10 days', 'On confirmation'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Template');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-upload-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    return sendError(res, 'Failed to generate template.', 500);
  }
};

// POST /api/products/stock/import  (Admin only)
// Bulk Excel/CSV upload. Column order matches the PHP system exactly:
// 0=Item Type, 1=Product Master, 2=Product Family, 3=Product Subfamily,
// 4=Item Group, 5=Category, 6=ItemCode, 7=ItemName,
// 8=InStock, 9=NetPrice, 10=Xceed-LP, 11=EDD, 12=RAD
const bulkImportStock = async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded.', 400);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows.length) return sendError(res, 'The uploaded file has no data rows.', 400);

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      if (i === 0) continue; // header row
      const row = rows[i];

      const itemCode = String(row[6] ?? '').trim().toUpperCase();
      const itemName = String(row[7] ?? '').trim();
      if (!itemCode) { skipped++; continue; }

      try {
        const itemGroup = String(row[4] ?? '').trim();
        let categoryId = null;
        if (itemGroup) {
          const mapping = await prisma.itemGroupMapping.findUnique({ where: { itemGroup } });
          categoryId = mapping?.categoryId || null;
        }

        const data = {
          itemCode,
          itemName: itemName || itemCode,
          itemType: String(row[0] ?? 'Regular').trim() || 'Regular',
          productMaster: String(row[1] ?? '').trim() || null,
          productFamily: String(row[2] ?? '').trim() || null,
          productSubfamily: String(row[3] ?? '').trim() || null,
          itemGroup: itemGroup || null,
          categoryCode: String(row[5] ?? '').trim().toUpperCase() || null,
          categoryId,
          availableStock: Number(row[8] ?? 0) || 0,
          netPrice: Number(row[9] ?? 0) || 0,
          xceedLp: Number(row[10] ?? 0) || 0,
          edd: String(row[11] ?? '').trim() || null,
          rad: String(row[12] ?? '').trim() || null,
          lastUpdated: new Date(),
        };

        const existing = await prisma.stock.findUnique({ where: { itemCode } });
        if (existing) {
          await prisma.stock.update({ where: { itemCode }, data });
          updated++;
        } else {
          await prisma.stock.create({ data });
          inserted++;
        }
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr.message || 'Unknown error' });
      }
    }

    if (inserted === 0 && updated === 0) {
      return sendError(res, 'No valid rows found. Check that ItemCode (column G) is populated.', 400);
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'STOCK_BULK_IMPORT',
        entityType: 'Stock',
        details: JSON.stringify({ inserted, updated, skipped, errorCount: errors.length }),
      },
    });

    const msg = `Import complete: ${inserted} inserted, ${updated} updated.` + (skipped ? ` ${skipped} row(s) skipped (no item code).` : '');
    return sendSuccess(res, { inserted, updated, skipped, errors }, msg);
  } catch (err) {
    console.error('bulkImportStock:', err);
    return sendError(res, 'Failed to process the uploaded file. Make sure it is a valid .xlsx, .xls, or .csv file.', 500);
  }
};

module.exports = { getStock, getStockAlerts, getStockStats, createStock, updateStock, deleteStock, downloadTemplate, bulkImportStock };
