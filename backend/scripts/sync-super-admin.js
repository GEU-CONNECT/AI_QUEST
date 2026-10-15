require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function syncSuperAdmin() {
  console.log('👑 [AI Quest] Syncing Super Admin credentials...');

  const superAdminName = process.env.SUPER_ADMIN_NAME || 'AI Quest Chief Administrator';
  const superAdminMobile = process.env.SUPER_ADMIN_MOBILE || '9999999999';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@geu.ac.in';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AIQuest@GEU2026';

  const hash = await bcrypt.hash(superAdminPassword, 12);

  // 1. Upsert by mobile number
  const admin = await prisma.user.upsert({
    where: { mobileNo: superAdminMobile },
    update: {
      name: superAdminName,
      role: 'ADMIN',
      email: superAdminEmail,
      passwordHash: hash
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

  // 2. Also ensure any existing ADMIN role or ADMIN-001 registrationId has the new hash
  await prisma.user.updateMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { registrationId: 'ADMIN-001' }
      ]
    },
    data: {
      passwordHash: hash
    }
  });

  console.log(`✅ Super Admin synced successfully!`);
  console.log(`   Name: ${admin.name}`);
  console.log(`   Mobile: ${superAdminMobile}`);
  console.log(`   Email: ${superAdminEmail}`);
  console.log(`   Password updated successfully.`);
}

syncSuperAdmin()
  .catch((err) => {
    console.error('❌ Error syncing Super Admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
