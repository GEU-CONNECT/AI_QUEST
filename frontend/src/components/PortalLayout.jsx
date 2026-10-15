import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutGrid,
  LogOut,
  CheckSquare,
  CheckCircle2,
  BookOpen,
  FileText,
  Users,
  Plus,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  GraduationCap,
  BarChart3,
  ExternalLink,
  Activity,
  Award,
  Shield,
  ShieldAlert,
  Building2,
  Unlock,
  Archive
} from 'lucide-react';
import { getHubUrl, handleAppLogout, getInitial } from '../utils/navigation';

/**
 * Authentic GEU Connect Legacy Sidebar & Layout for QuizX
 */
const PortalLayout = ({
  user,
  activeTab,
  onTabChange,
  children
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = user?.role === 'ADMIN';
  const isSubAdmin = user?.role === 'SUBADMIN';
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'COURSE_CREATOR';
  const isStudent = user?.role === 'STUDENT';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Build role-specific navigation items
  const handleNavItemClick = (itemId) => {
    if (onTabChange) onTabChange(itemId);
    setIsMobileMenuOpen(false);
    const roleHome = isAdmin ? "/admin" : (isFaculty || isSubAdmin) ? "/faculty" : "/student";
    if (location.pathname !== roleHome) {
      navigate(roleHome);
    }
  };

  const navItems = [];

  if (isSubAdmin) {
    // Lab Sub-Admins: Strictly restricted to Candidate Unlock / Reset & Live Monitor
    navItems.push(
      { id: 'candidate-lockouts', name: 'Unlock / Reset Candidates', icon: <Unlock size={18} /> },
      { id: 'live-monitor', name: 'Live Exam Monitor', icon: <Activity size={18} /> }
    );
  } else if (isAdmin) {
    // Super Administrator: Full Governance & Assessment Management
    navItems.push(
      { id: 'students', name: 'Registered Candidates', icon: <Users size={18} /> },
      { id: 'create-quiz', name: 'Create Quiz', icon: <PlusCircle size={18} /> },
      { id: 'quizzes', name: 'All Quizzes', icon: <CheckSquare size={18} /> },
      { id: 'results', name: 'Results & Rankings', icon: <Award size={18} /> },
      { id: 'submissions', name: 'Submissions', icon: <FileText size={18} /> },
      { id: 'create-subadmin', name: 'Create Sub-Admins', icon: <Building2 size={18} /> },
      { id: 'live-monitor', name: 'Live Monitor', icon: <Activity size={18} /> },
      { id: 'proctoring-rules', name: 'Proctoring Rules', icon: <ShieldAlert size={18} /> },
      { id: 'courses', name: 'Subjects', icon: <BookOpen size={18} /> },
      { id: 'academic-structure', name: 'Academic Setup', icon: <GraduationCap size={18} /> }
    );
  } else if (isFaculty) {
    navItems.push(
      { id: 'quizzes', name: 'My Quizzes', icon: <CheckSquare size={18} /> },
      { id: 'create-quiz', name: 'Create Quiz', icon: <PlusCircle size={18} /> },
      { id: 'candidate-lockouts', name: 'Unlock Sessions', icon: <Unlock size={18} /> },
      { id: 'courses', name: 'Subjects', icon: <BookOpen size={18} /> },
      { id: 'gradebook', name: 'Results', icon: <BarChart3 size={18} /> }
    );
  } else {
    // Student
    navItems.push(
      { id: 'active', name: 'Available Assessments', icon: <CheckSquare size={18} /> },
      { id: 'completed', name: 'Completed Examinations', icon: <Clock size={18} /> }
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {/* ========================================================= */}
      {/* 1. TOP HEADER (Fixed 64px, White, Clean institutional)     */}
      {/* ========================================================= */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200/90 shadow-2xs flex items-center justify-between px-3 sm:px-6 z-40 transition-colors">
        <div className="flex items-center gap-2 sm:gap-4 h-full">
          {/* Mobile Hamburger Toggle Button */}
          <button
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open Mobile Menu"
          >
            <Menu size={22} />
          </button>

          {/* Graphic Era Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/geu-logo.webp"
              alt="Graphic Era University"
              className="h-8 sm:h-9 object-contain"
            />
            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />
            <div className="hidden sm:flex flex-col">
              <span className="text-sm sm:text-base font-extrabold text-[#1c1f58] tracking-tight leading-tight">
                QuizX Assessment
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                Graphic Era University
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Navigation: Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* User Profile Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#fbc02d] flex items-center justify-center text-[#1c1f58] font-black shadow-xs text-sm sm:text-base shrink-0 hover:ring-2 hover:ring-offset-2 hover:ring-[#1c1f58] transition-all cursor-pointer active:scale-95"
              aria-label="User profile menu"
            >
              {getInitial(user?.name, isAdmin ? 'A' : isFaculty ? 'F' : 'S')}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70">
                  <p className="text-sm font-bold text-[#1c1f58] truncate">
                    {user?.name || 'Authenticated User'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    {user?.email || ''}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#1c1f58] border border-blue-100 px-2 py-0.5 rounded-full">
                      {user?.role || 'USER'}
                    </span>
                    {(user?.registrationId || user?.universityId || user?.mobileNo) && (
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-full">
                        {user.registrationId || user.universityId || user.mobileNo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2 space-y-1">

                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleAppLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. MOBILE DRAWER BACKDROP                                  */}
      {/* ========================================================= */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ========================================================= */}
      {/* 3. SIGNATURE GEU CONNECT ROYAL NAVY SIDEBAR (#1c1f58)      */}
      {/* ========================================================= */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-[#1c1f58] text-white border-r border-[#131540] z-[70] lg:z-30 shrink-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#131540] bg-[#171a4a]">
          <div className="flex items-center gap-2.5">
            <img
              src="/geu-logo.webp"
              alt="GEU Logo"
              className="h-8 object-contain bg-white rounded-md p-0.5"
            />
            <div className="leading-tight">
              <span className="font-extrabold text-sm text-white tracking-wide block">
                QuizX
              </span>
              <span className="text-[10px] text-gray-300 font-medium">
                {isAdmin ? 'Admin' : user?.role === 'SUBADMIN' ? 'Lab Invigilator' : isFaculty ? 'Faculty' : 'Student'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-gray-300 hover:text-white hover:bg-[#292d7c] rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 py-5 space-y-1 px-3 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2.5 px-3">
            Navigation Menu
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavItemClick(item.id)}
                className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 text-left cursor-pointer group ${
                  isActive
                    ? 'bg-[#131540] text-[#fbc02d] shadow-inner font-extrabold'
                    : 'text-gray-300 hover:bg-[#292d7c] hover:text-white'
                }`}
                style={
                  isActive
                    ? { borderLeft: '4px solid #fbc02d' }
                    : { borderLeft: '4px solid transparent' }
                }
              >
                <span
                  className={`mr-3 transition-colors shrink-0 ${
                    isActive ? 'text-[#fbc02d]' : 'text-gray-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate flex-1">{item.name}</span>
              </button>
            );
          })}


        </nav>

        {/* Sidebar Persistent Footer */}
        <div className="p-3 border-t border-[#131540] bg-[#161947]">
          <button
            type="button"
            onClick={handleAppLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 4. MAIN WORKSPACE CONTENT CONTAINER                        */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col pt-16 lg:pl-64 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
