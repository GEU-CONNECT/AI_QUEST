const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Ensure database URL is set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:../prisma/dev.db';
}

const prisma = new PrismaClient();

const REPORT_PATH = '/var/www/aiquest/current/recovery-report.json';
const LOCAL_REPORT_PATH = path.join(__dirname, '../recovery-report.json');

const normalizeIndianMobile = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '').trim();
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
};

// Safe shell command runner
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 15000 }).trim();
  } catch (e) {
    return '';
  }
}

// Deep binary carver for raw SQLite files / chunks
function carveStudentsFromBuffer(buf, sourceName = 'binary') {
  if (!buf || buf.length === 0) return [];
  const content = buf.toString('latin1');
  const carvedList = [];
  const seenRegIds = new Set();

  const regIdRegex = /GEU-AIQ-2026-\d{5}/g;
  let match;

  while ((match = regIdRegex.exec(content)) !== null) {
    const regId = match[0];
    if (seenRegIds.has(regId)) continue;
    seenRegIds.add(regId);

    const pos = match.index;
    const chunk = content.slice(Math.max(0, pos - 50), Math.min(content.length, pos + 800));

    // Try finding UUID before regId
    const preChunk = chunk.slice(0, Math.min(pos, 50));
    const uuidMatch = preChunk.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    const afterRegId = chunk.slice(chunk.indexOf(regId) + regId.length);

    // Look for bcrypt hash
    const hashMatch = afterRegId.match(/\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}/);
    if (!hashMatch) continue;

    const beforeHash = afterRegId.slice(0, hashMatch.index);
    const mobileMatch = beforeHash.match(/([6-9]\d{9})/);
    if (!mobileMatch) continue;

    const mobile = mobileMatch[1];
    const mobileIdx = beforeHash.indexOf(mobile);
    const name = beforeHash.slice(0, mobileIdx).replace(/[\x00-\x1f]/g, '').trim();
    const email = beforeHash.slice(mobileIdx + 10).replace(/[\x00-\x1f]/g, '').trim();

    const afterHash = afterRegId.slice(hashMatch.index + hashMatch[0].length);
    if (!afterHash.includes('STUDENT')) continue;

    const studentIdx = afterHash.indexOf('STUDENT');
    const labMatch = afterHash.match(/LAB-\d{2}/);
    const labNumber = labMatch ? labMatch[0] : 'LAB-01';

    const metaChunk = labMatch ? afterHash.slice(studentIdx + 7, labMatch.index) : afterHash.slice(studentIdx + 7, studentIdx + 250);
    const tokens = metaChunk.split(/[\x00-\x1f]+/).map(s => s.trim()).filter(Boolean);

    let studentClass = 'Class 12th';
    let stream = 'Science (PCM)';
    let schoolName = 'General School';
    let parentName = 'Guardian';
    let parentContact = mobile;
    let city = 'Dehradun';

    for (const t of tokens) {
      if (/Class\s*(9|10|11|12|Dropper)/i.test(t)) {
        studentClass = t;
      } else if (/Science|PCM|PCB|Commerce|Arts/i.test(t)) {
        stream = t;
      } else if (/School|Academy|College|Campus|Public|Vidyalaya|Grammar|Home/i.test(t)) {
        schoolName = t;
      } else if (/^[6-9]\d{9}$/.test(t)) {
        parentContact = t;
      } else if (/Dehradun|Delhi|Haridwar|Roorkee|Rishikesh|Nainital|Haldwani|Varanasi|Lucknow|Chandigarh/i.test(t)) {
        city = t;
      } else if (!parentName || parentName === 'Guardian') {
        if (t.length >= 2 && t.length <= 40) parentName = t;
      }
    }

    carvedList.push({
      id: uuidMatch ? uuidMatch[0] : crypto.randomUUID(),
      registrationId: regId,
      name: name || 'AI Quest Candidate',
      mobileNo: mobile,
      email: email || `${mobile}@event.geu.ac.in`,
      passwordHash: hashMatch[0],
      role: 'STUDENT',
      studentClass,
      stream,
      schoolName,
      parentName,
      parentContact,
      city,
      labNumber,
      source: `Carved from ${sourceName}`
    });
  }

  return carvedList;
}

async function main() {
  console.log('====================================================');
  console.log('🔍 [AI QUEST] Candidate Recovery & Protection System');
  console.log('====================================================');

  const report = {
    startedAt: new Date().toISOString(),
    scannedLocations: [],
    foundDbFiles: [],
    sourcesInspected: {},
    recoveredCandidatesTotal: 0,
    activeDbBeforeTotal: 0,
    activeDbAfterTotal: 0,
    newlyRestoredCount: 0,
    success: false
  };

  // 1. Get current count in active database
  try {
    report.activeDbBeforeTotal = await prisma.user.count({ where: { role: 'STUDENT' } });
    console.log(`📊 Active DB currently has ${report.activeDbBeforeTotal} registered students.`);
  } catch (e) {
    console.warn('⚠️ Could not query active DB count before recovery:', e.message);
  }

  // 2. Discover ALL candidate database files and backups across filesystem
  const searchDirs = [
    '/home/ubuntu/.db_backups',
    '/home/ubuntu/.db_backups_history',
    '/home/ubuntu/.db_backups_temp_protect',
    '/home/ubuntu/AI_QUEST/backend/prisma',
    '/home/ubuntu',
    '/tmp',
    '/var/backups',
    '/var/tmp'
  ];

  const candidateFiles = new Set();

  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      report.scannedLocations.push(sDir);
      try {
        const findOut = runCmd(`find ${sDir} -maxdepth 4 \\( -name "*.db*" -o -name "*.sqlite*" -o -name "*backup*" \\) -type f 2>/dev/null`);
        if (findOut) {
          findOut.split('\n').map(s => s.trim()).filter(Boolean).forEach(f => candidateFiles.add(f));
        }
      } catch (e) {}
    }
  }

  // 3. Search open file descriptors for unlinked / older dev.db in running processes
  console.log('🔎 Checking /proc/*/fd for active open file descriptors...');
  const procFdOut = runCmd("ls -l /proc/*/fd/* 2>/dev/null | grep -E 'dev\\.db|aiquest' || true");
  if (procFdOut) {
    const lines = procFdOut.split('\n');
    for (const line of lines) {
      const match = line.match(/(\/proc\/\d+\/fd\/\d+)\s+->\s+(.+)/);
      if (match) {
        const fdPath = match[1];
        const targetPath = match[2];
        try {
          const stats = fs.statSync(fdPath);
          if (stats.size > 20000) {
            const recoveryFdCopy = `/tmp/recovered_fd_${Date.now()}_${path.basename(targetPath.replace(/[^a-zA-Z0-9._-]/g, '_'))}`;
            fs.copyFileSync(fdPath, recoveryFdCopy);
            candidateFiles.add(recoveryFdCopy);
            console.log(`✨ Captured active process open file descriptor: ${fdPath} -> ${recoveryFdCopy} (${stats.size} bytes)`);
          }
        } catch (e) {}
      }
    }
  }

  const allFilesList = Array.from(candidateFiles);
  console.log(`📁 Found ${allFilesList.length} potential database files to inspect.`);

  const studentMap = new Map(); // key: mobileNo or regId -> candidate object
  const submissionMap = new Map(); // key: quizId_studentId -> submission object

  // Helper to register candidate into recovery pool
  function registerCandidate(c) {
    const cleanMobile = normalizeIndianMobile(c.mobileNo);
    const regId = (c.registrationId || '').toUpperCase().trim();
    if (!cleanMobile && !regId) return;

    const existingKey = (cleanMobile && studentMap.has(cleanMobile)) ? cleanMobile : (regId && studentMap.has(regId) ? regId : null);

    const merged = {
      id: c.id || crypto.randomUUID(),
      registrationId: regId || `GEU-AIQ-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      name: c.name || 'AI Quest Candidate',
      mobileNo: cleanMobile || c.mobileNo,
      email: c.email || `${cleanMobile || 'student'}@event.geu.ac.in`,
      passwordHash: c.passwordHash || '$2a$10$w8T98O0n0oO4wJ6hB/X5nOaXGkW5v9hI5C.wWv1q7WvW5zJ9M2Z2a',
      role: 'STUDENT',
      studentClass: c.studentClass || 'Class 12th',
      stream: c.stream || 'Science (PCM)',
      schoolName: c.schoolName || 'General School',
      parentName: c.parentName || 'Guardian',
      parentContact: c.parentContact || cleanMobile || c.mobileNo,
      city: c.city || 'Dehradun',
      labNumber: c.labNumber || 'LAB-01',
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      source: c.source || 'Recovered'
    };

    if (existingKey) {
      // Merge richer fields
      const existing = studentMap.get(existingKey);
      if (existing.name === 'AI Quest Candidate' && merged.name !== 'AI Quest Candidate') existing.name = merged.name;
      if (existing.schoolName === 'General School' && merged.schoolName !== 'General School') existing.schoolName = merged.schoolName;
      if (!existing.registrationId && merged.registrationId) existing.registrationId = merged.registrationId;
    } else {
      if (cleanMobile) studentMap.set(cleanMobile, merged);
      if (regId) studentMap.set(regId, merged);
    }
  }

  // 4. First inspect current DB users to make sure we don't drop anyone
  try {
    const currentStudents = await prisma.user.findMany({ where: { role: 'STUDENT' } });
    currentStudents.forEach(s => registerCandidate({ ...s, source: 'Active Database' }));
    console.log(`📌 Loaded ${currentStudents.length} candidates from active database into pool.`);
  } catch (e) {
    console.warn('⚠️ Could not load current students from active db:', e.message);
  }

  // 5. Query each candidate database file
  for (const filePath of allFilesList) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const stats = fs.statSync(filePath);
      if (stats.size < 10000) continue; // Skip empty files

      console.log(`🔍 Inspecting: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)...`);
      report.foundDbFiles.push({ path: filePath, sizeBytes: stats.size, mtime: stats.mtime });

      let attachedCount = 0;
      let carvedCount = 0;

      // Method A: Try SQLite ATTACH DATABASE via Prisma
      try {
        const attachAlias = `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await prisma.$executeRawUnsafe(`ATTACH DATABASE "${filePath}" AS ${attachAlias}`);
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${attachAlias}.User WHERE role = 'STUDENT'`);
        if (rows && rows.length > 0) {
          attachedCount = rows.length;
          rows.forEach(r => registerCandidate({ ...r, source: `SQLite table in ${filePath}` }));
          console.log(`  ✅ SQLite ATTACH recovered ${rows.length} candidates from ${filePath}!`);
        }

        // Also check QuizSubmission
        try {
          const subs = await prisma.$queryRawUnsafe(`SELECT * FROM ${attachAlias}.QuizSubmission`);
          if (subs && subs.length > 0) {
            subs.forEach(s => {
              const k = `${s.quizId}_${s.studentId}`;
              if (!submissionMap.has(k)) submissionMap.set(k, s);
            });
            console.log(`  📝 Recovered ${subs.length} quiz submissions from ${filePath}.`);
          }
        } catch (subErr) {}

        await prisma.$executeRawUnsafe(`DETACH DATABASE ${attachAlias}`);
      } catch (attachErr) {
        // Detach might have failed or not attached, ignore error
      }

      // Method B: Deep binary carve
      try {
        const buf = fs.readFileSync(filePath);
        const carved = carveStudentsFromBuffer(buf, filePath);
        if (carved.length > 0) {
          carvedCount = carved.length;
          carved.forEach(c => registerCandidate(c));
          console.log(`  🔬 Deep binary carver extracted ${carved.length} candidates from ${filePath}!`);
        }
      } catch (carveErr) {
        console.warn(`  ⚠️ Carve failed for ${filePath}:`, carveErr.message);
      }

      report.sourcesInspected[filePath] = {
        attachedCount,
        carvedCount,
        sizeBytes: stats.size
      };
    } catch (err) {
      console.warn(`⚠️ Error processing file ${filePath}:`, err.message);
    }
  }

  // 6. Check PM2 and Nginx logs for any registration records
  const logPaths = [
    '/home/ubuntu/.pm2/logs/aiquest-backend-out.log',
    '/home/ubuntu/.pm2/logs/aiquest-backend-error.log',
    '/var/log/nginx/access.log',
    '/var/log/nginx/access.log.1'
  ];

  for (const lPath of logPaths) {
    if (fs.existsSync(lPath)) {
      try {
        const logContent = fs.readFileSync(lPath, 'utf8');
        const phoneMatches = logContent.match(/[6-9]\d{9}/g) || [];
        const regMatches = logContent.match(/GEU-AIQ-2026-\d{5}/g) || [];
        console.log(`📜 Log ${lPath}: Found ${phoneMatches.length} phone traces, ${regMatches.length} RegID traces.`);
      } catch (e) {}
    }
  }

  // Deduplicate all unique candidates
  const uniqueCandidateList = Array.from(new Set(studentMap.values()));
  report.recoveredCandidatesTotal = uniqueCandidateList.length;
  console.log('====================================================');
  console.log(`🎯 TOTAL UNIQUE CANDIDATES IN RECOVERY POOL: ${uniqueCandidateList.length}`);
  console.log('====================================================');

  // 7. Insert / Upsert all recovered candidates into current live database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const cand of uniqueCandidateList) {
    try {
      const cleanMobile = normalizeIndianMobile(cand.mobileNo);
      if (!cleanMobile) continue;

      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { mobileNo: cleanMobile },
            { mobileNo: '91' + cleanMobile },
            { mobileNo: '0' + cleanMobile },
            { registrationId: cand.registrationId }
          ]
        }
      });

      if (!existing) {
        // Ensure registrationId is unique
        let finalRegId = cand.registrationId;
        const regConflict = await prisma.user.findUnique({ where: { registrationId: finalRegId } });
        if (regConflict) {
          finalRegId = `GEU-AIQ-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        }

        await prisma.user.create({
          data: {
            id: cand.id || crypto.randomUUID(),
            registrationId: finalRegId,
            name: cand.name || 'Candidate',
            mobileNo: cleanMobile,
            email: cand.email || `${cleanMobile}@event.geu.ac.in`,
            passwordHash: cand.passwordHash,
            role: 'STUDENT',
            studentClass: cand.studentClass || 'Class 12th',
            stream: cand.stream || 'Science (PCM)',
            schoolName: cand.schoolName || 'General School',
            parentName: cand.parentName || 'Guardian',
            parentContact: cand.parentContact || cleanMobile,
            city: cand.city || 'Dehradun',
            labNumber: cand.labNumber || 'LAB-01',
            createdAt: cand.createdAt || new Date()
          }
        });
        insertedCount++;
      } else {
        // Update if existing record has placeholder data
        if (existing.name === 'AI Quest Candidate' && cand.name !== 'AI Quest Candidate') {
          await prisma.user.update({
            where: { id: existing.id },
            data: { name: cand.name }
          });
          updatedCount++;
        }
      }
    } catch (insertErr) {
      console.warn(`⚠️ Error inserting candidate ${cand.mobileNo} (${cand.registrationId}):`, insertErr.message);
    }
  }

  report.newlyRestoredCount = insertedCount;
  console.log(`✨ Successfully inserted ${insertedCount} missing candidates and enriched ${updatedCount} candidates!`);

  // 8. Restore Quiz Submissions if any were lost
  let subInsertedCount = 0;
  for (const sub of submissionMap.values()) {
    try {
      const exists = await prisma.quizSubmission.findUnique({
        where: {
          quizId_studentId: {
            quizId: sub.quizId,
            studentId: sub.studentId
          }
        }
      });
      if (!exists) {
        await prisma.quizSubmission.create({
          data: {
            id: sub.id || crypto.randomUUID(),
            quizId: sub.quizId,
            studentId: sub.studentId,
            studentRollNo: sub.studentRollNo || '0000',
            studentName: sub.studentName || 'Student',
            answers: sub.answers || '{}',
            score: Number(sub.score || 0),
            totalMarks: Number(sub.totalMarks || 20),
            percentage: Number(sub.percentage || 0),
            isPassed: Boolean(sub.isPassed),
            status: sub.status || 'SUBMITTED',
            tabViolations: Number(sub.tabViolations || 0),
            lockReason: sub.lockReason || null,
            startedAt: sub.startedAt ? new Date(sub.startedAt) : new Date(),
            submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : new Date()
          }
        });
        subInsertedCount++;
      }
    } catch (sErr) {}
  }
  if (subInsertedCount > 0) {
    console.log(`📝 Restored ${subInsertedCount} quiz submissions.`);
  }

  // 9. Count total students after recovery
  try {
    report.activeDbAfterTotal = await prisma.user.count({ where: { role: 'STUDENT' } });
    console.log(`🏁 FINISHED: Active DB now has ${report.activeDbAfterTotal} registered students!`);
    report.success = true;
  } catch (e) {
    console.warn('⚠️ Could not query active DB count after recovery:', e.message);
  }

  // 10. Create a permanent, read-only Golden Backup so this can NEVER be lost
  try {
    const goldenDir = '/home/ubuntu/.db_backups';
    if (!fs.existsSync(goldenDir)) fs.mkdirSync(goldenDir, { recursive: true });
    const liveDbPath = '/home/ubuntu/AI_QUEST/backend/prisma/dev.db';
    if (fs.existsSync(liveDbPath)) {
      const goldenBackupPath = path.join(goldenDir, 'aiquest_dev_db_GOLDEN_RESTORED.db');
      fs.copyFileSync(liveDbPath, goldenBackupPath);
      runCmd(`chmod 444 "${goldenBackupPath}" || true`);
      console.log(`🛡️ Created immutable Golden Backup at ${goldenBackupPath}`);
    }
  } catch (e) {
    console.warn('⚠️ Golden backup copy warning:', e.message);
  }

  report.completedAt = new Date().toISOString();

  // 11. Write report to webroot and local folder
  try {
    const reportJson = JSON.stringify(report, null, 2);
    if (fs.existsSync(path.dirname(REPORT_PATH))) {
      fs.writeFileSync(REPORT_PATH, reportJson, 'utf8');
      console.log(`📋 Recovery report written to web root: ${REPORT_PATH}`);
    }
    fs.writeFileSync(LOCAL_REPORT_PATH, reportJson, 'utf8');
  } catch (e) {}

  return report;
}

if (require.main === module) {
  main()
    .then((r) => {
      console.log('Recovery completed successfully:', r.success);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Recovery failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main, carveStudentsFromBuffer };
