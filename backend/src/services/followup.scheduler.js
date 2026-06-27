const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFollowUps() {
  try {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Upcoming in next 24h
    const upcoming24 = await prisma.meeting.findMany({
      where: { nextFollowUp: { gte: in24h, lt: in48h }, status: { notIn: ['CLOSED','LOST'] }, reminderSent: false },
      select: { id: true, userId: true, assignedToId: true },
    });
    for (const m of upcoming24) {
      const targets = [...new Set([m.userId, m.assignedToId].filter(Boolean))];
      for (const uid of targets) {
        await prisma.followUpAlert.create({ data: { meetingId: m.id, userId: uid, alertType: 'UPCOMING_24H' } }).catch(() => {});
      }
      await prisma.meeting.update({ where: { id: m.id }, data: { reminderSent: true } });
    }

    // Same-day alerts
    const sameDay = await prisma.meeting.findMany({
      where: { nextFollowUp: { gte: now, lt: endOfDay }, status: { notIn: ['CLOSED','LOST'] } },
      select: { id: true, userId: true, assignedToId: true },
    });
    for (const m of sameDay) {
      const targets = [...new Set([m.userId, m.assignedToId].filter(Boolean))];
      for (const uid of targets) {
        await prisma.followUpAlert.create({ data: { meetingId: m.id, userId: uid, alertType: 'UPCOMING_SAME_DAY' } }).catch(() => {});
      }
    }

    // Overdue
    const overdue = await prisma.meeting.findMany({
      where: { nextFollowUp: { lt: now }, status: { notIn: ['CLOSED','LOST'] } },
      select: { id: true, userId: true, assignedToId: true },
    });
    for (const m of overdue) {
      const targets = [...new Set([m.userId, m.assignedToId].filter(Boolean))];
      for (const uid of targets) {
        await prisma.followUpAlert.create({ data: { meetingId: m.id, userId: uid, alertType: 'OVERDUE' } }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[FollowUpScheduler]', err.message);
  }
}

function startScheduler() {
  cron.schedule('0 * * * *', checkFollowUps);
  setTimeout(checkFollowUps, 5000);
  console.log('📅 Follow-up scheduler started (hourly)');
}

module.exports = { startScheduler };
