require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const proctoringRoutes = require('./routes/proctoringRoutes');
const adminRoutes = require('./routes/adminRoutes');

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

// Fallback compatibility route for courses and academic config
app.get('/api/courses', (req, res) => {
  res.json({ success: true, courses: [] });
});

app.get('/api/academic/config', (req, res) => {
  res.json({
    success: true,
    academicTerm: { termType: 'ODD', academicYear: '2026-2027', activeSemesters: [1, 3, 5, 7] },
    activeSemesters: [1, 3, 5, 7],
    universities: [],
    departments: []
  });
});

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

// Ensure activeSessionId column exists in SQLite User table safely
(async () => {
  try {
    const prisma = require('./config/db');
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const hasCol = Array.isArray(tableInfo) && tableInfo.some((col) => col.name === 'activeSessionId');
    if (!hasCol) {
      await prisma.$queryRawUnsafe(`ALTER TABLE "User" ADD COLUMN "activeSessionId" TEXT`);
      console.log('🔒 [AI Quest Security] Single-device activeSessionId column initialized successfully.');
    }
  } catch (err) {
    // Column already exists or non-sqlite provider
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
