# AI QUEST 2026 - Official Event & Examination Platform

Official event registration, proctored quiz engine, and live leaderboard portal for Graphic Era University's **AI Quest 2026** Grand Championship.

## 🌟 Key Architecture & Features

1. **Candidate Onboarding & Self-Service Registration**
   - 3D interactive holographic pass and candidate badge preview
   - Auto-allocation to examination lab clusters (`LAB-01` through `LAB-20`)
   - Unique candidate registration ID generation (format: `GEU-AIQ-2026-XXXXX`)
   - Instant single-field candidate lookup & authentication via Mobile Number / Registration ID

2. **Proctored Examination Engine (QuizX Subsystem)**
   - Timed multiple-choice assessment with fullscreen enforcement
   - Real-time tab switch and violation monitoring (`AUTO_LOCK` after threshold)
   - Live automated scoring, instant answer key validation, and percentage calculations

3. **Three-Tier Role-Based Access Control (RBAC)**
   - **ADMIN**: Complete system governance, event overview metrics, question vault management, comprehensive student data export to Excel (`.xlsx`), and live leaderboard access.
   - **SUBADMIN (Lab Invigilators)**: Lab-specific student supervision, violation unlocks, candidate verification, and lab leaderboard.
   - **STUDENT**: Assessment room access, test taking, and evaluated gradebook results.

4. **Default Demonstration Credentials**
   - **Chief Administrator**: Mobile `9999999999` | Password `admin123`
   - **Lab Invigilators**: Mobile `9800000001` to `9800000020` (LAB-01 to LAB-20) | Password `lab123`
   - **Sample Candidate**: Mobile `9812345678` | PIN `1234`

---

## 🚀 Running Locally

### Backend Setup
```bash
cd backend
npm install
npx prisma generate
npm run seed     # Seeds super admin, 20 lab invigilators, and official AI Quest exam
npm run dev      # Runs API server on http://localhost:5005
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev      # Launches Vite dev server on http://localhost:5173
```

---

## 🌐 Production Deployment

- **Public Production URL**: `https://aiquest.pblgeu.online`
- **Reverse Proxy**: Nginx routing `/` to `/var/www/aiquest/current` and `/api/` to `http://127.0.0.1:5005`
- **Process Manager**: PM2 fork mode running `aiquest-backend`
