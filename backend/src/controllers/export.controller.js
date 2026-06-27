const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { sendError } = require('../utils/response');

const prisma = new PrismaClient();

// ── Shared export plumbing ────────────────────────────────────────────

function csvEscape(val) {
  const s = String(val ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => csvEscape(c.value(r))).join(','));
  return [header, ...lines].join('\r\n');
}

function toExcelBuffer(rows, columns, sheetName) {
  const wb = XLSX.utils.book_new();
  const data = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => c.value(r)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function streamPDF(res, rows, columns, title, filenameBase) {
  const landscape = columns.length > 5;
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
  doc.pipe(res);

  const pageWidth = landscape ? 770 : 523;
  const colWidth = pageWidth / columns.length;

  doc.fillColor('#1E3A5F').fontSize(15).font('Helvetica-Bold').text(title, 36, 36);
  doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica').text(`Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} records`, 36, 56);

  let y = 80;
  const rowH = 18;

  const drawHeader = () => {
    doc.rect(36, y, pageWidth, rowH).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    columns.forEach((c, i) => doc.text(c.label, 36 + i * colWidth + 4, y + 5, { width: colWidth - 8 }));
    y += rowH;
  };
  drawHeader();

  doc.font('Helvetica').fontSize(7.5);
  rows.forEach((r, idx) => {
    if (y > (landscape ? 520 : 760)) {
      doc.addPage({ margin: 36, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
      y = 36;
      drawHeader();
      doc.font('Helvetica').fontSize(7.5);
    }
    if (idx % 2 === 0) doc.rect(36, y - 2, pageWidth, rowH).fill('#F8FAFC');
    doc.fillColor('#374151');
    columns.forEach((c, i) => {
      const val = String(c.value(r) ?? '').substring(0, 40);
      doc.text(val, 36 + i * colWidth + 4, y + 2, { width: colWidth - 8 });
    });
    y += rowH;
  });

  doc.end();
}

function sendExport(res, { rows, columns, filenameBase, title, format }) {
  const fmt = (format || 'csv').toLowerCase();
  if (fmt === 'excel' || fmt === 'xlsx') {
    const buffer = toExcelBuffer(rows, columns, title);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(buffer);
  }
  if (fmt === 'pdf') {
    return streamPDF(res, rows, columns, title, filenameBase);
  }
  // default: csv
  const csv = toCSV(rows, columns);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
  return res.send(csv);
}

function dateRange(req) {
  const { from, to } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) { const end = new Date(to); end.setDate(end.getDate() + 1); range.lt = end; }
  return Object.keys(range).length ? range : undefined;
}

const filenameStamp = () => new Date().toISOString().slice(0, 10);

// ── Customers ──────────────────────────────────────────────────────────
const exportCustomers = async (req, res) => {
  try {
    const range = dateRange(req);
    const customers = await prisma.customer.findMany({
      where: { isActive: true, ...(range && { createdAt: range }) },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const columns = [
      { label: 'Company Name', value: (r) => r.companyName },
      { label: 'Contact Person', value: (r) => r.contactPerson },
      { label: 'Designation', value: (r) => r.designation },
      { label: 'Phone', value: (r) => r.contactNumber },
      { label: 'Email', value: (r) => r.email },
      { label: 'Location', value: (r) => r.location },
      { label: 'Category', value: (r) => r.category },
      { label: 'Industry', value: (r) => r.industryType },
      { label: 'Created By', value: (r) => r.createdBy?.name },
      { label: 'Created Date', value: (r) => new Date(r.createdAt).toLocaleDateString('en-IN') },
    ];
    sendExport(res, { rows: customers, columns, filenameBase: `customers-${filenameStamp()}`, title: 'Customer Report', format: req.query.format });
  } catch (err) {
    console.error('exportCustomers:', err);
    sendError(res, 'Failed to generate customer report.', 500);
  }
};

// ── Meetings / Follow-ups ────────────────────────────────────────────
const exportMeetings = async (req, res) => {
  try {
    const range = dateRange(req);
    const meetings = await prisma.meeting.findMany({
      where: range ? { meetingDate: range } : {},
      include: { customer: { select: { companyName: true } }, user: { select: { name: true } } },
      orderBy: { meetingDate: 'desc' },
    });
    const columns = [
      { label: 'Customer', value: (r) => r.customer?.companyName },
      { label: 'Sales Rep', value: (r) => r.user?.name },
      { label: 'Meeting Date', value: (r) => new Date(r.meetingDate).toLocaleDateString('en-IN') },
      { label: 'Type', value: (r) => r.meetingType },
      { label: 'Status', value: (r) => r.status },
      { label: 'Notes', value: (r) => r.notes },
      { label: 'Next Follow-Up', value: (r) => r.nextFollowUp ? new Date(r.nextFollowUp).toLocaleDateString('en-IN') : '' },
      { label: 'Trial Status', value: (r) => r.trialStatus },
    ];
    sendExport(res, { rows: meetings, columns, filenameBase: `followups-${filenameStamp()}`, title: 'Follow-Up Report', format: req.query.format });
  } catch (err) {
    console.error('exportMeetings:', err);
    sendError(res, 'Failed to generate follow-up report.', 500);
  }
};

// ── Quotations ────────────────────────────────────────────────────────
const exportQuotations = async (req, res) => {
  try {
    const range = dateRange(req);
    const quotations = await prisma.quotation.findMany({
      where: range ? { createdAt: range } : {},
      include: { customer: { select: { companyName: true } }, user: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const columns = [
      { label: 'Quotation No', value: (r) => r.quotationNumber },
      { label: 'Customer', value: (r) => r.customer?.companyName },
      { label: 'Sales Rep', value: (r) => r.user?.name },
      { label: 'Items', value: (r) => r._count?.items },
      { label: 'Total Amount', value: (r) => r.totalAmount.toFixed(2) },
      { label: 'Status', value: (r) => r.status },
      { label: 'Approval', value: (r) => r.approvalStatus },
      { label: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString('en-IN') },
    ];
    sendExport(res, { rows: quotations, columns, filenameBase: `quotations-${filenameStamp()}`, title: 'Quotation Report', format: req.query.format });
  } catch (err) {
    console.error('exportQuotations:', err);
    sendError(res, 'Failed to generate quotation report.', 500);
  }
};

// ── Products ──────────────────────────────────────────────────────────
const exportProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { categoryRef: { select: { name: true } } },
      orderBy: { itemCode: 'asc' },
    });
    const columns = [
      { label: 'Item Code', value: (r) => r.itemCode },
      { label: 'Product Name', value: (r) => r.productName },
      { label: 'Category', value: (r) => r.categoryRef?.name || r.category },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Standard Price', value: (r) => r.standardPrice.toFixed(2) },
      { label: 'HSN Code', value: (r) => r.hsnCode },
      { label: 'Drawing No', value: (r) => r.drawingNumber },
    ];
    sendExport(res, { rows: products, columns, filenameBase: `products-${filenameStamp()}`, title: 'Product Report', format: req.query.format });
  } catch (err) {
    console.error('exportProducts:', err);
    sendError(res, 'Failed to generate product report.', 500);
  }
};

// ── Attendance (+ location log) ──────────────────────────────────────
const exportAttendance = async (req, res) => {
  try {
    const range = dateRange(req);
    const records = await prisma.attendance.findMany({
      where: range ? { date: range } : {},
      include: { user: { select: { name: true, department: true } }, _count: { select: { locationPings: true } } },
      orderBy: { date: 'desc' },
    });
    const columns = [
      { label: 'Employee', value: (r) => r.user?.name },
      { label: 'Department', value: (r) => r.user?.department },
      { label: 'Date', value: (r) => new Date(r.date).toLocaleDateString('en-IN') },
      { label: 'Check In', value: (r) => r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN') : '' },
      { label: 'Check Out', value: (r) => r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN') : '' },
      { label: 'Working Hours', value: (r) => r.workingHours ?? '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'GPS Pings Logged', value: (r) => r._count?.locationPings ?? 0 },
    ];
    sendExport(res, { rows: records, columns, filenameBase: `attendance-${filenameStamp()}`, title: 'Attendance & Location Report', format: req.query.format });
  } catch (err) {
    console.error('exportAttendance:', err);
    sendError(res, 'Failed to generate attendance report.', 500);
  }
};

// ── Leaves ────────────────────────────────────────────────────────────
const exportLeaves = async (req, res) => {
  try {
    const range = dateRange(req);
    const leaves = await prisma.leave.findMany({
      where: range ? { fromDate: range } : {},
      include: { user: { select: { name: true, department: true } } },
      orderBy: { fromDate: 'desc' },
    });
    const columns = [
      { label: 'Employee', value: (r) => r.user?.name },
      { label: 'Department', value: (r) => r.user?.department },
      { label: 'Type', value: (r) => r.leaveType },
      { label: 'From', value: (r) => new Date(r.fromDate).toLocaleDateString('en-IN') },
      { label: 'To', value: (r) => new Date(r.toDate).toLocaleDateString('en-IN') },
      { label: 'Days', value: (r) => r.totalDays },
      { label: 'Status', value: (r) => r.status },
      { label: 'Reason', value: (r) => r.reason },
    ];
    sendExport(res, { rows: leaves, columns, filenameBase: `leaves-${filenameStamp()}`, title: 'Leave Report', format: req.query.format });
  } catch (err) {
    console.error('exportLeaves:', err);
    sendError(res, 'Failed to generate leave report.', 500);
  }
};

// ── Users / team ──────────────────────────────────────────────────────
const exportUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    const columns = [
      { label: 'Name', value: (r) => r.name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Role', value: (r) => r.role },
      { label: 'Department', value: (r) => r.department },
      { label: 'Phone', value: (r) => r.phone },
      { label: 'Status', value: (r) => (r.isActive ? 'Active' : 'Inactive') },
      { label: 'Joined', value: (r) => new Date(r.createdAt).toLocaleDateString('en-IN') },
    ];
    sendExport(res, { rows: users, columns, filenameBase: `team-${filenameStamp()}`, title: 'Team Report', format: req.query.format });
  } catch (err) {
    console.error('exportUsers:', err);
    sendError(res, 'Failed to generate team report.', 500);
  }
};

// ── Activity log ─────────────────────────────────────────────────────
const exportActivity = async (req, res) => {
  try {
    const range = dateRange(req);
    const logs = await prisma.activityLog.findMany({
      where: range ? { createdAt: range } : {},
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const columns = [
      { label: 'User', value: (r) => r.user?.name },
      { label: 'Role', value: (r) => r.user?.role },
      { label: 'Action', value: (r) => r.action },
      { label: 'Entity Type', value: (r) => r.entityType },
      { label: 'Date/Time', value: (r) => new Date(r.createdAt).toLocaleString('en-IN') },
    ];
    sendExport(res, { rows: logs, columns, filenameBase: `activity-log-${filenameStamp()}`, title: 'Activity Log Report', format: req.query.format });
  } catch (err) {
    console.error('exportActivity:', err);
    sendError(res, 'Failed to generate activity log report.', 500);
  }
};

module.exports = {
  exportCustomers, exportMeetings, exportQuotations, exportProducts,
  exportAttendance, exportLeaves, exportUsers, exportActivity,
};
