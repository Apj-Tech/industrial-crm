const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

// Quotation number format: TMS/{year}/{4-digit padded sequence}
// Ported as-is from the PHP system (QuotationModel::getNextQuotationNo).
async function generateQuotationNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quotation.count();
  return `TMS/${year}/${String(count + 1).padStart(4, '0')}`;
}

// Per-line calc: net = unitPrice * (1 - discount%); total = net * quantity.
// Ported exactly from the PHP system (QuotationModel::saveItems / grandTotalFromItems).
function calcItem(item) {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const netPrice = Math.round(unitPrice * (1 - discount / 100) * 100) / 100;
  const totalPrice = Math.round(netPrice * quantity * 100) / 100;
  return { quantity, unitPrice, discount, netPrice, totalPrice };
}

// GET /api/quotations
const getQuotations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customerId, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(req.user.role !== 'ADMIN' && { userId: req.user.id }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { quotationNumber: { contains: search } },
          { toName: { contains: search } },
          { subject: { contains: search } },
          { customer: { companyName: { contains: search } } },
        ],
      }),
    };

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, companyName: true, contactPerson: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    return sendPaginated(res, quotations, total, page, limit, 'Quotations fetched');
  } catch (err) {
    console.error('getQuotations:', err);
    return sendError(res, 'Failed to fetch quotations.', 500);
  }
};

// GET /api/quotations/stats
const getQuotationStats = async (req, res) => {
  try {
    const where = req.user.role !== 'ADMIN' ? { userId: req.user.id } : {};
    const [total, draft, submitted, negotiation, po, closed, lost] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.quotation.count({ where: { ...where, status: 'QUOTATION_SUBMITTED' } }),
      prisma.quotation.count({ where: { ...where, status: 'NEGOTIATION' } }),
      prisma.quotation.count({ where: { ...where, status: 'PURCHASE_ORDER' } }),
      prisma.quotation.count({ where: { ...where, status: 'CLOSED' } }),
      prisma.quotation.count({ where: { ...where, status: 'LOST' } }),
    ]);
    return sendSuccess(res, { total, draft, submitted, negotiation, purchaseOrder: po, closed, lost });
  } catch (err) {
    return sendError(res, 'Failed to fetch quotation stats.', 500);
  }
};

// GET /api/quotations/:id
const getQuotation = async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: { select: { itemCode: true, hsnCode: true } } } },
        approvals: { include: { requestBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!quotation) return sendError(res, 'Quotation not found.', 404);
    return sendSuccess(res, { quotation });
  } catch (err) {
    return sendError(res, 'Failed to fetch quotation.', 500);
  }
};

function buildItemsCreate(items) {
  return items.map((item) => {
    const calc = calcItem(item);
    return {
      productId: item.productId || null,
      itemCode: item.itemCode,
      productName: item.productName,
      description: item.description || '',
      category: item.category || '',
      unit: item.unit || 'PCS',
      ...calc,
      delivery: item.delivery || '',
      hsnCode: item.hsnCode || '',
    };
  });
}

function letterheadFields(body) {
  return {
    quotationDate: body.quotationDate ? new Date(body.quotationDate) : new Date(),
    enquiryDate: body.enquiryDate ? new Date(body.enquiryDate) : null,
    toName: body.toName?.trim() || '',
    toAddr1: body.toAddr1?.trim() || '',
    toAddr2: body.toAddr2?.trim() || '',
    toState: body.toState?.trim() || '',
    kindAttn: body.kindAttn?.trim() || '',
    toDesignation: body.toDesignation?.trim() || '',
    enquiryRef: body.enquiryRef?.trim() || '',
    subject: body.subject?.trim() || 'Quotation for Cutting Tools',
    salesTax: body.salesTax?.trim() || '18% GST Extra',
    paymentTerms: body.paymentTerms?.trim() || '',
    validity: body.validity?.trim() || '15 Days',
    deliveryCharges: body.deliveryCharges?.trim() || '',
    signCompany: body.signCompany?.trim() || '',
    signName: body.signName?.trim() || '',
    signDesignation: body.signDesignation?.trim() || '',
  };
}

// POST /api/quotations
const createQuotation = async (req, res) => {
  try {
    const { customerId, items = [], notes, validUntil } = req.body;
    if (!customerId) return sendError(res, 'Customer is required.', 400);
    if (!items.length) return sendError(res, 'At least one item is required.', 400);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return sendError(res, 'Customer not found.', 404);

    const itemsCreate = buildItemsCreate(items);
    const totalAmount = itemsCreate.reduce((sum, it) => sum + it.totalPrice, 0);
    const quotationNumber = await generateQuotationNumber();

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId,
        userId: req.user.id,
        totalAmount: Math.round(totalAmount * 100) / 100,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        ...letterheadFields(req.body),
        items: { create: itemsCreate },
      },
      include: { customer: true, items: true, user: { select: { id: true, name: true } } },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'QUOTATION_CREATED',
        entityType: 'Quotation',
        entityId: quotation.id,
        details: JSON.stringify({ quotationNumber, customerId, totalAmount: quotation.totalAmount }),
      },
    });

    return sendSuccess(res, { quotation }, 'Quotation created successfully', 201);
  } catch (err) {
    console.error('createQuotation:', err);
    return sendError(res, 'Failed to create quotation.', 500);
  }
};

// PUT /api/quotations/:id
const updateQuotation = async (req, res) => {
  try {
    const { items, notes, validUntil, status } = req.body;
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 'Quotation not found.', 404);
    if (existing.approvalStatus === 'APPROVED') return sendError(res, 'Cannot edit an approved quotation.', 400);

    const updateData = {
      notes,
      status: status || existing.status,
      validUntil: validUntil ? new Date(validUntil) : existing.validUntil,
      version: existing.version + 1,
      ...letterheadFields(req.body),
    };

    if (items && items.length > 0) {
      const itemsCreate = buildItemsCreate(items);
      updateData.totalAmount = Math.round(itemsCreate.reduce((sum, it) => sum + it.totalPrice, 0) * 100) / 100;

      await prisma.quotationItem.deleteMany({ where: { quotationId: req.params.id } });
      updateData.items = { create: itemsCreate };
    }

    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: updateData,
      include: { customer: true, items: true, user: { select: { id: true, name: true } } },
    });

    return sendSuccess(res, { quotation }, 'Quotation updated successfully');
  } catch (err) {
    console.error('updateQuotation:', err);
    return sendError(res, 'Failed to update quotation.', 500);
  }
};

// DELETE /api/quotations/:id  (Admin only)
const deleteQuotation = async (req, res) => {
  try {
    await prisma.quotation.delete({ where: { id: req.params.id } });
    return sendSuccess(res, {}, 'Quotation deleted');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Quotation not found.', 404);
    return sendError(res, 'Failed to delete quotation.', 500);
  }
};

// PATCH /api/quotations/:id/approve  (Admin only)
const approveQuotation = async (req, res) => {
  try {
    const { action, note } = req.body; // action: 'APPROVED' | 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(action)) return sendError(res, 'Invalid action.', 400);

    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: {
        approvalStatus: action,
        approvedById: req.user.id,
        approvedAt: new Date(),
        status: action === 'APPROVED' ? 'QUOTATION_SUBMITTED' : 'DRAFT',
      },
    });

    await prisma.approval.create({
      data: { type: 'QUOTATION', entityId: req.params.id, requestById: req.user.id, status: action, note, quotationId: req.params.id },
    });

    return sendSuccess(res, { quotation }, `Quotation ${action.toLowerCase()} successfully`);
  } catch (err) {
    return sendError(res, 'Failed to update approval.', 500);
  }
};

// GET /api/quotations/:id/pdf — streams a PDF matching the TMS letterhead layout
const generatePDF = async (req, res) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!q) return sendError(res, 'Quotation not found.', 404);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${q.quotationNumber.replace(/\//g, '-')}.pdf"`);
    doc.pipe(res);

    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const fmtMoney = (n) => `Rs.${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ── Header ─────────────────────────────────
    doc.fillColor('#1E3A5F').fontSize(15).font('Helvetica-Bold')
       .text(q.signCompany || 'Tulips Machining Solutions', 50, 50);
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
       .text('Cutting Tools & Solutions', 50, 68);

    doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold')
       .text('QUOTATION', 350, 50, { width: 195, align: 'right' });
    doc.fillColor('#374151').fontSize(9).font('Helvetica')
       .text(`No: ${q.quotationNumber}`, 350, 68, { width: 195, align: 'right' })
       .text(`Date: ${fmtDate(q.quotationDate || q.createdAt)}`, 350, 81, { width: 195, align: 'right' });

    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 105).lineTo(545, 105).stroke();

    // ── To / Enquiry block ─────────────────────
    doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold').text('TO', 50, 118);
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(q.toName || q.customer.companyName, 50, 131);
    doc.fillColor('#6B7280').fontSize(8.5).font('Helvetica')
       .text(q.toAddr1 || '', 50, 146)
       .text(q.toAddr2 || '', 50, 158)
       .text(q.toState || '', 50, 170);
    let y = 184;
    if (q.kindAttn) {
      doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold').text('Kind Attn: ', 50, y, { continued: true })
         .font('Helvetica').fillColor('#374151').text(`${q.kindAttn}${q.toDesignation ? ', ' + q.toDesignation : ''}`);
      y += 14;
    }

    doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold').text('ENQUIRY REF', 350, 118);
    doc.fillColor('#111827').fontSize(9).font('Helvetica').text(q.enquiryRef || '—', 350, 131);
    doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold').text('ENQUIRY DATE', 350, 148);
    doc.fillColor('#111827').fontSize(9).font('Helvetica').text(fmtDate(q.enquiryDate), 350, 161);

    if (q.subject) {
      doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold').text('Sub: ', 50, y + 6, { continued: true })
         .font('Helvetica').text(q.subject);
      y += 22;
    }

    // ── Items table ────────────────────────────
    const tableTop = y + 24;
    const cols = [50, 78, 165, 295, 335, 380, 420, 460, 500];
    const widths = [28, 87, 130, 40, 45, 40, 40, 40, 45];
    const headers = ['#', 'Code', 'Description', 'Cat', 'MOQ', 'Rate', 'Disc%', 'Net', 'Amount'];

    doc.rect(50, tableTop, 495, 18).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    headers.forEach((h, i) => doc.text(h, cols[i], tableTop + 5, { width: widths[i], align: i >= 4 ? 'right' : 'left' }));

    let rowY = tableTop + 22;
    q.items.forEach((item, idx) => {
      const rowH = 20;
      if (idx % 2 === 0) doc.rect(50, rowY - 3, 495, rowH).fill('#F8FAFC');
      doc.fillColor('#374151').font('Helvetica').fontSize(7.5);
      doc.text(String(idx + 1), cols[0], rowY, { width: widths[0] });
      doc.text(item.itemCode, cols[1], rowY, { width: widths[1] });
      doc.text((item.description || item.productName || '').substring(0, 60), cols[2], rowY, { width: widths[2] });
      doc.text(item.category || '', cols[3], rowY, { width: widths[3], align: 'right' });
      doc.text(String(item.quantity), cols[4], rowY, { width: widths[4], align: 'right' });
      doc.text(item.unitPrice.toFixed(2), cols[5], rowY, { width: widths[5], align: 'right' });
      doc.text(item.discount > 0 ? `${item.discount}%` : '—', cols[6], rowY, { width: widths[6], align: 'right' });
      doc.text(item.netPrice.toFixed(2), cols[7], rowY, { width: widths[7], align: 'right' });
      doc.font('Helvetica-Bold').text(item.totalPrice.toFixed(2), cols[8], rowY, { width: widths[8], align: 'right' });
      rowY += rowH;
    });

    doc.rect(50, rowY, 495, 22).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5)
       .text('Grand Total', 50, rowY + 6, { width: 405, align: 'right' })
       .text(fmtMoney(q.totalAmount), 500, rowY + 6, { width: 45, align: 'right' });

    // ── Terms ─────────────────────────────────
    let termsY = rowY + 38;
    const terms = [
      ['Sales Tax', q.salesTax], ['Payment Terms', q.paymentTerms],
      ['Validity', q.validity], ['Delivery Charges', q.deliveryCharges],
    ].filter(([, v]) => v);
    if (terms.length) {
      const colW = 495 / Math.min(terms.length, 4);
      terms.slice(0, 4).forEach(([label, val], i) => {
        doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8).text(`${label}:`, 50 + i * colW, termsY, { width: colW - 8 });
        doc.fillColor('#6B7280').font('Helvetica').fontSize(8).text(val, 50 + i * colW, termsY + 11, { width: colW - 8 });
      });
      termsY += 36;
    }

    // ── Signature ─────────────────────────────
    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text(q.signCompany || '', 380, termsY + 20, { width: 165, align: 'right' });
    doc.strokeColor('#CBD5E1').moveTo(380, termsY + 60).lineTo(545, termsY + 60).stroke();
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5).text(q.signName || '', 380, termsY + 64, { width: 165, align: 'right' });
    doc.fillColor('#6B7280').font('Helvetica').fontSize(8).text(q.signDesignation || '', 380, termsY + 76, { width: 165, align: 'right' });

    doc.fillColor('#9CA3AF').fontSize(7.5).font('Helvetica')
       .text('This is a computer-generated document.', 50, 780, { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('generatePDF:', err);
    return sendError(res, 'Failed to generate PDF.', 500);
  }
};

module.exports = {
  getQuotations, getQuotationStats, getQuotation, createQuotation,
  updateQuotation, deleteQuotation, approveQuotation, generatePDF,
};
