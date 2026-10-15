const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ai_quest_event_2026_jwt_secret_secure_key';

const generateToken = (user, sessionId) => {
  return jwt.sign(
    {
      userId: user.id,
      registrationId: user.registrationId,
      name: user.name,
      mobileNo: user.mobileNo,
      role: user.role,
      labNumber: user.labNumber,
      sessionId: sessionId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

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

// @desc    Register a new student candidate
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const {
      candidateName,
      mobileNo,
      emailId,
      studentClass,
      stream,
      schoolName,
      parentName,
      parentContact,
      city,
      password,
      labNumber
    } = req.body;

    const cleanName = String(candidateName || '').trim();
    const cleanMobile = normalizeIndianMobile(mobileNo);
    const cleanEmail = String(emailId || '').trim().toLowerCase();
    const cleanParentContact = normalizeIndianMobile(parentContact);

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, message: 'Candidate full name is required (min 2 characters).' });
    }

    if (!cleanMobile || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit Indian mobile number is required (starts with 6-9).' });
    }

    if (!cleanParentContact || !/^[6-9]\d{9}$/.test(cleanParentContact)) {
      return res.status(400).json({ success: false, message: "Valid 10-digit parent's contact number is required (starts with 6-9)." });
    }

    if (cleanMobile === cleanParentContact) {
      return res.status(400).json({
        success: false,
        message: 'Candidate phone number should be different from parents.'
      });
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required.' });
    }

    // Check if phone or email already registered
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { mobileNo: cleanMobile },
          { mobileNo: '91' + cleanMobile },
          { mobileNo: '0' + cleanMobile },
          { mobileNo: { endsWith: cleanMobile } },
          { email: cleanEmail }
        ]
      }
    });

    if (existingUser) {
      const isMobileDuplicate =
        existingUser.mobileNo === cleanMobile ||
        existingUser.mobileNo === '91' + cleanMobile ||
        existingUser.mobileNo.endsWith(cleanMobile);

      if (isMobileDuplicate) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: `Mobile number ${cleanMobile} is already registered. Please login directly with this number.`
        });
      }
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `Email ${cleanEmail} is already registered. Please login or use a different email.`
      });
    }

    // Determine Lab allocation: Use provided lab or auto-assign to LAB-01 through LAB-20
    let assignedLab = labNumber;
    if (!assignedLab) {
      const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });
      const labIndex = (totalStudents % 20) + 1;
      assignedLab = `LAB-${String(labIndex).padStart(2, '0')}`;
    }

    // Generate unique Registration ID: GEU-AIQ-2026-XXXXX
    let regId = '';
    let isUnique = false;
    while (!isUnique) {
      const suffix = Math.floor(10000 + Math.random() * 90000);
      regId = `GEU-AIQ-2026-${suffix}`;
      const conflict = await prisma.user.findUnique({ where: { registrationId: regId } });
      if (!conflict) isUnique = true;
    }

    // Candidate PIN / Password: Default to last 4 digits of phone if not specified
    const rawSecret = String(password || cleanMobile.slice(-4)).trim();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawSecret, salt);

    const sessionId = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const user = await prisma.user.create({
      data: {
        registrationId: regId,
        name: cleanName,
        mobileNo: cleanMobile,
        email: cleanEmail,
        passwordHash,
        role: 'STUDENT',
        studentClass: studentClass || 'Class 12th',
        stream: stream || 'Science (PCM)',
        schoolName: schoolName || 'General School',
        parentName: parentName || 'Guardian',
        parentContact: cleanParentContact,
        city: city || 'Dehradun',
        labNumber: assignedLab,
        activeSessionId: sessionId
      }
    });

    const token = generateToken(user, sessionId);

    res.status(201).json({
      success: true,
      message: 'Candidate registration successful! Welcome to AI Quest 2026.',
      token,
      regId,
      user: {
        id: user.id,
        registrationId: user.registrationId,
        name: user.name,
        mobileNo: user.mobileNo,
        email: user.email,
        role: user.role,
        studentClass: user.studentClass,
        stream: user.stream,
        schoolName: user.schoolName,
        parentName: user.parentName,
        parentContact: user.parentContact,
        city: user.city,
        labNumber: user.labNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Candidate & Administrative Login
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { identifier, phone, password } = req.body;
    const rawSearch = String(identifier || phone || '').trim();

    if (!rawSearch) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, registration ID, or email is required.'
      });
    }

    // Lookup user by mobile, registration ID, email, or username alias
    const normalizedInput = rawSearch.toLowerCase();
    const cleanDigits = rawSearch.replace(/\D/g, '');
    const normMobile = normalizeIndianMobile(rawSearch);

    let labAlias = null;
    if (normalizedInput.startsWith('lab')) {
      const numPart = normalizedInput.replace(/\D/g, '');
      if (numPart) {
        labAlias = `LAB-${numPart.padStart(2, '0')}`;
      }
    }

    const orConditions = [];

    // 1. Mobile number matches (canonical 10-digit, with 91, with 0, endsWith, or exact cleanDigits)
    if (normMobile) {
      orConditions.push({ mobileNo: normMobile });
      orConditions.push({ mobileNo: '91' + normMobile });
      orConditions.push({ mobileNo: '0' + normMobile });
      orConditions.push({ mobileNo: { endsWith: normMobile } });
    }
    if (cleanDigits && cleanDigits !== normMobile) {
      orConditions.push({ mobileNo: cleanDigits });
    }
    orConditions.push({ mobileNo: rawSearch });

    // 2. Registration ID matches (exact uppercase, trimmed, or ID suffix contains)
    orConditions.push({ registrationId: rawSearch.toUpperCase() });
    orConditions.push({ registrationId: rawSearch });
    if (rawSearch.length >= 4) {
      orConditions.push({ registrationId: { contains: rawSearch.toUpperCase() } });
    }

    // 3. Email matches
    orConditions.push({ email: normalizedInput });
    orConditions.push({ email: { startsWith: normalizedInput + '@' } });
    if (normalizedInput.includes('@')) {
      orConditions.push({ email: { contains: normalizedInput } });
    }

    // 4. Name or Username matches
    orConditions.push({ name: rawSearch });
    if (rawSearch.length >= 3) {
      orConditions.push({ name: { contains: rawSearch } });
    }

    // 5. Role aliases
    if (normalizedInput === 'admin') {
      orConditions.push({ role: 'ADMIN' });
    }
    if (labAlias) {
      orConditions.push({ labNumber: labAlias, role: 'SUBADMIN' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: orConditions
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No registered account found matching these details. Please register first.'
      });
    }

    // Password verification:
    // Students log in directly with their registered mobile number (no password needed).
    // Administrative accounts (ADMIN / SUBADMIN) require password.
    if (user.role === 'ADMIN' || user.role === 'SUBADMIN') {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: 'Password required for administrative accounts.'
        });
      }
      const isMatch = await bcrypt.compare(String(password).trim(), user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid administrative password entered.'
        });
      }
    }

    // Single-Device Security: Generate a fresh session ID
    // Updating activeSessionId in the database immediately invalidates any other logged-in device
    const sessionId = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { activeSessionId: sessionId }
    });
    user.activeSessionId = sessionId;

    const token = generateToken(user, sessionId);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user.id,
        registrationId: user.registrationId,
        name: user.name,
        mobileNo: user.mobileNo,
        email: user.email,
        role: user.role,
        studentClass: user.studentClass,
        stream: user.stream,
        schoolName: user.schoolName,
        parentName: user.parentName,
        parentContact: user.parentContact,
        city: user.city,
        labNumber: user.labNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        submissions: {
          select: {
            id: true,
            quizId: true,
            status: true,
            score: true,
            percentage: true,
            isPassed: true,
            tabViolations: true,
            submittedAt: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        registrationId: user.registrationId,
        name: user.name,
        mobileNo: user.mobileNo,
        email: user.email,
        role: user.role,
        studentClass: user.studentClass,
        stream: user.stream,
        schoolName: user.schoolName,
        parentName: user.parentName,
        parentContact: user.parentContact,
        city: user.city,
        labNumber: user.labNumber,
        submissions: user.submissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Fast session check to verify if current device session is still active
// @route   GET /api/auth/session-check
const checkSessionStatus = async (req, res) => {
  // protect middleware has verified activeSessionId matches decoded.sessionId
  res.json({
    success: true,
    active: true,
    userId: req.user.id,
    role: req.user.role
  });
};

module.exports = {
  register,
  login,
  getMe,
  checkSessionStatus
};
