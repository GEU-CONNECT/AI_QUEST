require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const proctoringRoutes = require('./routes/proctoringRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');
const { getAcademicConfig } = require('./controllers/academicController');

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Quest 2026 Event Platform API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Quest 2026 Event Platform API',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Dynamic academic config route
app.get('/api/academic/config', getAcademicConfig);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[AI Quest Error]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found on AI Quest Server`
  });
});

// Ensure activeSessionId column and database tables exist in SQLite safely on boot
(async () => {
  try {
    const prisma = require('./config/db');
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const hasCol = Array.isArray(tableInfo) && tableInfo.some((col) => col.name === 'activeSessionId');
    if (!hasCol) {
      await prisma.$queryRawUnsafe(`ALTER TABLE "User" ADD COLUMN "activeSessionId" TEXT`);
      console.log('🔒 [AI Quest Security] Single-device activeSessionId column initialized successfully.');
    }

    // Auto-create Course table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Course" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "semester" INTEGER NOT NULL DEFAULT 1,
        "department" TEXT NOT NULL DEFAULT 'CSE',
        "universityId" TEXT,
        "description" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Course_code_key" ON "Course"("code");`);

    // Auto-create University & Department tables if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "University" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "University_code_key" ON "University"("code");`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Department" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "universityId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("universityId") REFERENCES "University" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    console.log('📚 [AI Quest] Academic & Course database tables verified/initialized successfully.');

    // Auto-sync Super Admin credentials on boot from environment variables
    try {
      const bcrypt = require('bcryptjs');
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AIQuest@GEU2026';
      const superAdminMobile = process.env.SUPER_ADMIN_MOBILE || '9999999999';
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@geu.ac.in';
      const superAdminName = process.env.SUPER_ADMIN_NAME || 'AI Quest Chief Administrator';

      const hash = await bcrypt.hash(superAdminPassword, 12);

      await prisma.user.upsert({
        where: { mobileNo: superAdminMobile },
        update: {
          passwordHash: hash,
          role: 'ADMIN',
          email: superAdminEmail,
          name: superAdminName
        },
        create: {
          registrationId: 'ADMIN-001',
          name: superAdminName,
          mobileNo: superAdminMobile,
          email: superAdminEmail,
          passwordHash: hash,
          role: 'ADMIN',
          labNumber: 'MAIN-CONTROL'
        }
      });

      await prisma.user.updateMany({
        where: {
          OR: [
            { role: 'ADMIN' },
            { registrationId: 'ADMIN-001' }
          ]
        },
        data: { passwordHash: hash }
      });
      console.log('👑 [AI Quest Security] Super Admin credentials verified/synced on boot.');
    } catch (adminSyncErr) {
      console.error('[AI Quest Admin Boot Sync Error]', adminSyncErr.message);
    }
  } catch (err) {
    console.error('[AI Quest Init Error]', err.message);
  }
})();


app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 AI Quest 2026 Backend running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔒 Single-Device Session Security Active`);
  console.log(`===============================================`);
});

module.exports = app;
