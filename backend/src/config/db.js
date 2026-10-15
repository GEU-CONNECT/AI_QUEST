const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// Canonical SQLite database file: backend/prisma/dev.db
const canonicalDbPath = path.resolve(__dirname, '../../prisma/dev.db');
process.env.DATABASE_URL = `file:${canonicalDbPath}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${canonicalDbPath}`
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

// Configure SQLite for high concurrency (WAL mode + 10s busy timeout)
async function initSqlitePragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  } catch (err) {
    console.error('Failed to set SQLite PRAGMA journal_mode:', err.message);
  }
}
initSqlitePragmas();

module.exports = prisma;

