const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Categories (ported from the PHP TMS quotation system's default set)
  const categoryDefs = [
    { name: 'Insert',  color: '#1a4fa0', sortOrder: 1 },
    { name: 'Endmill', color: '#166534', sortOrder: 2 },
    { name: 'Drill',   color: '#9333ea', sortOrder: 3 },
    { name: 'Tap',     color: '#b45309', sortOrder: 4 },
    { name: 'Cutter',  color: '#0e7490', sortOrder: 5 },
    { name: 'Holder',  color: '#be185d', sortOrder: 6 },
    { name: 'Other',   color: '#64748b', sortOrder: 7 },
  ];
  const categories = {};
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    categories[c.name] = cat;
  }
  console.log('✅ Categories seeded');

  // Item-group → category mapping, used to auto-classify Excel stock imports
  const itemGroupMap = [
    { itemGroup: 'Insert',                category: 'Insert' },
    { itemGroup: 'Endmil/Balnose /Drill', category: 'Endmill' },
    { itemGroup: 'ENDMILL / DRILL',       category: 'Endmill' },
    { itemGroup: 'Holder',                category: 'Holder' },
    { itemGroup: 'Holder/Adaptor/Colec',  category: 'Holder' },
    { itemGroup: 'TOOL HOLDERS',          category: 'Holder' },
    { itemGroup: 'Reamer',                category: 'Cutter' },
    { itemGroup: 'Taps',                  category: 'Tap' },
    { itemGroup: 'Blade',                 category: 'Other' },
    { itemGroup: 'PARTS',                 category: 'Other' },
    { itemGroup: 'SCREW/BOLT/SHIM',       category: 'Other' },
    { itemGroup: 'WRENCH',                category: 'Other' },
    { itemGroup: 'CATALOGUE',             category: 'Other' },
    { itemGroup: 'PACKING MATERIAL',      category: 'Other' },
  ];
  for (const m of itemGroupMap) {
    await prisma.itemGroupMapping.upsert({
      where: { itemGroup: m.itemGroup },
      update: {},
      create: { itemGroup: m.itemGroup, categoryId: categories[m.category].id },
    });
  }
  console.log('✅ Item-group mappings seeded');

  // Create Admin user
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@company.com' } });
  if (!adminExists) {
    const hashedPw = await bcrypt.hash('Admin@123', 12);
    await prisma.user.create({
      data: {
        name: 'System Admin',
        email: 'admin@company.com',
        password: hashedPw,
        role: 'ADMIN',
        phone: '+91-9000000001',
        department: 'Management',
      },
    });
    console.log('✅ Admin user created → admin@company.com / Admin@123');
  }

  // Create Sales user
  const salesExists = await prisma.user.findUnique({ where: { email: 'sales@company.com' } });
  if (!salesExists) {
    const hashedPw = await bcrypt.hash('Sales@123', 12);
    const salesUser = await prisma.user.create({
      data: {
        name: 'Rahul Sales',
        email: 'sales@company.com',
        password: hashedPw,
        role: 'SALES',
        phone: '+91-9000000002',
        department: 'Sales',
      },
    });
    console.log('✅ Sales user created → sales@company.com / Sales@123');

    // Sample customers
    const admin = await prisma.user.findUnique({ where: { email: 'admin@company.com' } });
    const customers = await prisma.customer.createMany({
      data: [
        {
          companyName: 'Tata Motors Ltd',
          contactPerson: 'Suresh Kumar',
          contactNumber: '+91-9876543210',
          designation: 'Purchase Manager',
          email: 'suresh@tatamotors.com',
          location: 'Pune, Maharashtra',
          category: 'OEM',
          industryType: 'Automotive',
          remarks: 'High potential. Looking for cutting tools.',
          createdById: admin.id,
        },
        {
          companyName: 'Bharat Forge Pvt Ltd',
          contactPerson: 'Priya Sharma',
          contactNumber: '+91-9876543211',
          designation: 'Technical Head',
          email: 'priya@bharatforge.com',
          location: 'Pune, Maharashtra',
          category: 'Tier 1',
          industryType: 'Forging',
          remarks: 'Interested in carbide inserts.',
          createdById: admin.id,
        },
        {
          companyName: 'Mahindra CIE Automotive',
          contactPerson: 'Arun Patel',
          contactNumber: '+91-9876543212',
          designation: 'VMC Operator',
          email: 'arun@mahindra.com',
          location: 'Nashik, Maharashtra',
          category: 'OEM',
          industryType: 'Automotive',
          remarks: 'Trial order expected next month.',
          createdById: salesUser.id,
        },
      ],
    });
    console.log(`✅ ${customers.count} sample customers created`);

    // Sample products
    const productData = [
      {
        itemCode: 'CNMG120408-MF',
        productName: 'CNMG 120408-MF Turning Insert',
        description: 'CVD coated carbide insert for medium finishing of steel',
        unit: 'PCS',
        standardPrice: 285,
        category: 'Insert',
        categoryId: categories['Insert'].id,
        productRef: 'TMS-INS-001',
        hsnCode: '82073000',
      },
      {
        itemCode: 'APKT1604PDER-PH',
        productName: 'APKT 1604PDER-PH Milling Insert',
        description: 'PVD coated carbide insert for face milling',
        unit: 'PCS',
        standardPrice: 320,
        category: 'Insert',
        categoryId: categories['Insert'].id,
        productRef: 'TMS-INS-002',
        hsnCode: '82073000',
      },
      {
        itemCode: 'VBMT160404-FP',
        productName: 'VBMT 160404-FP Finishing Insert',
        description: 'Ultra-fine finish turning insert for hardened steel',
        unit: 'PCS',
        standardPrice: 375,
        category: 'Insert',
        categoryId: categories['Insert'].id,
        hsnCode: '82073000',
      },
      {
        itemCode: 'ER32-COLLET-12',
        productName: 'ER32 Collet Chuck 12mm',
        description: 'High precision spring collet, 12mm bore',
        unit: 'PCS',
        standardPrice: 1250,
        category: 'Holder',
        categoryId: categories['Holder'].id,
        hsnCode: '84669300',
      },
      {
        itemCode: 'DRILL-SOLID-10',
        productName: 'Solid Carbide Drill 10mm',
        description: '5xD solid carbide drill with internal coolant',
        unit: 'PCS',
        standardPrice: 1850,
        category: 'Drill',
        categoryId: categories['Drill'].id,
        hsnCode: '82071900',
      },
      {
        itemCode: 'EM-CARB-12-4FL',
        productName: 'Carbide End Mill 12mm 4-Flute',
        description: 'TiAlN coated, general purpose end mill',
        unit: 'PCS',
        standardPrice: 640,
        category: 'Endmill',
        categoryId: categories['Endmill'].id,
        hsnCode: '82072000',
      },
    ];

    const createdProducts = [];
    for (const p of productData) {
      const product = await prisma.product.create({ data: p });
      createdProducts.push(product);
    }
    console.log('✅ Sample products created');

    // Sample stock levels — most linked to a catalog product, some standalone
    // (mirrors the real-world Excel import, where the stock list is larger
    // than the curated, quotable product catalog).
    const stockLevels = [
      { itemType: 'Regular', itemGroup: 'Insert',  netPrice: 250,  xceedLp: 310,  availableStock: 150, reservedStock: 20, minimumStock: 50, location: 'Rack A-1' },
      { itemType: 'Regular', itemGroup: 'Insert',  netPrice: 280,  xceedLp: 350,  availableStock: 8,   reservedStock: 2,  minimumStock: 30, location: 'Rack A-2' },   // low stock
      { itemType: 'Regular', itemGroup: 'Insert',  netPrice: 330,  xceedLp: 410,  availableStock: 0,   reservedStock: 0,  minimumStock: 20, location: 'Rack B-1' },   // out of stock
      { itemType: 'Regular', itemGroup: 'Holder',  netPrice: 1100, xceedLp: 1380, availableStock: 65,  reservedStock: 5,  minimumStock: 15, location: 'Rack C-3' },
      { itemType: 'Regular', itemGroup: 'Drill',   netPrice: 1620, xceedLp: 2020, availableStock: 420, reservedStock: 10, minimumStock: 25, location: 'Rack D-1' },  // excess
      { itemType: 'Regular', itemGroup: 'Endmill', netPrice: 560,  xceedLp: 700,  availableStock: 90,  reservedStock: 8,  minimumStock: 20, location: 'Rack E-2' },
    ];
    for (let i = 0; i < createdProducts.length; i++) {
      const p = createdProducts[i];
      await prisma.stock.create({
        data: {
          itemCode: p.itemCode,
          itemName: p.productName,
          productId: p.id,
          categoryId: p.categoryId,
          edd: '7-10 days',
          rad: 'On confirmation',
          ...stockLevels[i],
        },
      });
    }

    // A couple of standalone stock rows with no catalog/product entry —
    // typical of a large Excel-imported inventory list
    await prisma.stock.createMany({
      data: [
        {
          itemCode: 'SCR-M6X20-SS',
          itemName: 'SS Socket Head Screw M6x20',
          itemType: 'Regular',
          itemGroup: 'SCREW/BOLT/SHIM',
          categoryId: categories['Other'].id,
          availableStock: 500,
          minimumStock: 100,
          netPrice: 8,
          xceedLp: 12,
          location: 'Rack F-1',
        },
        {
          itemCode: 'WR-ER32-SET',
          itemName: 'ER32 Collet Wrench Set',
          itemType: 'Regular',
          itemGroup: 'WRENCH',
          categoryId: categories['Other'].id,
          availableStock: 25,
          minimumStock: 5,
          netPrice: 450,
          xceedLp: 580,
          location: 'Rack F-2',
        },
      ],
    });
    console.log('✅ Sample stock levels created');

    // Sample quotation with full letterhead + commercial terms (TMS format)
    const firstCustomer = await prisma.customer.findFirst();
    if (firstCustomer) {
      const items = [
        { productId: createdProducts[0].id, itemCode: createdProducts[0].itemCode, productName: createdProducts[0].productName, category: 'Insert', unit: 'PCS', quantity: 100, unitPrice: 285, discount: 5, hsnCode: createdProducts[0].hsnCode },
        { productId: createdProducts[3].id, itemCode: createdProducts[3].itemCode, productName: createdProducts[3].productName, category: 'Holder', unit: 'PCS', quantity: 10, unitPrice: 1250, discount: 0, hsnCode: createdProducts[3].hsnCode },
      ];
      const itemsWithCalc = items.map((it) => {
        const netPrice = it.unitPrice * (1 - it.discount / 100);
        const totalPrice = netPrice * it.quantity;
        return { ...it, netPrice: Math.round(netPrice * 100) / 100, totalPrice: Math.round(totalPrice * 100) / 100, delivery: '2 Weeks' };
      });
      const grandTotal = itemsWithCalc.reduce((s, it) => s + it.totalPrice, 0);

      await prisma.quotation.create({
        data: {
          quotationNumber: `TMS/${new Date().getFullYear()}/0001`,
          customerId: firstCustomer.id,
          userId: salesUser.id,
          status: 'DRAFT',
          totalAmount: Math.round(grandTotal * 100) / 100,
          quotationDate: new Date(),
          toName: firstCustomer.companyName,
          toAddr1: firstCustomer.location || '',
          toState: 'Maharashtra',
          kindAttn: firstCustomer.contactPerson,
          toDesignation: firstCustomer.designation || '',
          subject: 'Quotation for Cutting Tools',
          salesTax: '18% GST Extra',
          paymentTerms: '30 Days from invoice',
          validity: '15 Days',
          deliveryCharges: 'Extra as applicable',
          signCompany: 'Tulips Machining Solutions',
          signName: 'Rahul Sales',
          signDesignation: 'Sales Executive',
          items: { create: itemsWithCalc },
        },
      });
      console.log('✅ Sample quotation created (TMS letterhead format)');
    }

    // Sample meeting / follow-up
    const allCustomers = await prisma.customer.findMany();
    if (allCustomers.length > 0) {
      const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
      await prisma.meeting.create({
        data: {
          customerId: allCustomers[0].id,
          userId: salesUser.id,
          meetingDate: new Date(),
          meetingType: 'VISIT',
          status: 'TRIAL_PLANNED',
          notes: 'Discussed requirements for CNMG inserts. Customer wants a trial batch before committing to bulk order.',
          summary: 'Positive first meeting, technical fit confirmed.',
          actionItems: 'Send trial samples by next week. Follow up on trial feedback.',
          nextFollowUp: nextWeek,
        },
      });
      console.log('✅ Sample meeting/follow-up created');
    }
  }

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
