const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// Auto-resolve SQLite DATABASE_URL if relative to prevent "unable to open database file"
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
  const rawPath = process.env.DATABASE_URL.replace(/^file:/, '');
  if (!path.isAbsolute(rawPath)) {
    const rootDir = path.resolve(__dirname, '../../');
    const cand1 = path.resolve(rootDir, rawPath);
    const cand2 = path.resolve(rootDir, 'prisma', rawPath.replace(/^\.\/prisma\//, './'));
    const cand3 = path.resolve(process.cwd(), rawPath);

    if (fs.existsSync(cand1)) {
      process.env.DATABASE_URL = `file:${cand1}`;
    } else if (fs.existsSync(cand2)) {
      process.env.DATABASE_URL = `file:${cand2}`;
    } else if (fs.existsSync(cand3)) {
      process.env.DATABASE_URL = `file:${cand3}`;
    }
  }
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

module.exports = prisma;

