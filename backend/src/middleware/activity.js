const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logActivity = (action, entityType = null) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      if (req.user && data?.success !== false) {
        try {
          await prisma.activityLog.create({
            data: {
              userId: req.user.id,
              action,
              entityType,
              entityId: req.params?.id || data?.data?.id || null,
              details: JSON.stringify({ method: req.method, path: req.path }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
        } catch (_) { /* silent fail — don't break response */ }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = { logActivity };
