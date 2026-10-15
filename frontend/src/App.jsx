import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import PortalLayout from "./components/PortalLayout";
import AuthLanding from "./pages/AuthLanding";
import AdminDashboard from "./pages/AdminDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import TakeQuiz from "./pages/TakeQuiz";
import QuizResults from "./pages/QuizResults";
import api from "./api/client";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("quizzes");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user?.role === "STUDENT" && activeTab === "quizzes") {
      setActiveTab("active");
    } else if (user?.role === "SUBADMIN" && (activeTab === "quizzes" || !["candidate-lockouts", "live-monitor"].includes(activeTab))) {
      setActiveTab("candidate-lockouts");
    }
  }, [user, activeTab]);

  // Single-Device Real-Time Session Heartbeat: Detects concurrent login on another device
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        await api.get("/auth/session-check");
      } catch (err) {
        // Handled by api/client.js response interceptor
      }
    }, 4000);

    const handleFocus = async () => {
      try {
        await api.get("/auth/session-check");
      } catch (_) {}
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem("quizx_token");
    const storedUser = localStorage.getItem("quizx_user");

    if (token) {
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (_) {}
      }
      try {
        const res = await api.get("/auth/me");
        if (res.data?.success) {
          setUser(res.data.user);
          localStorage.setItem("quizx_user", JSON.stringify(res.data.user));
        } else {
          localStorage.removeItem("quizx_token");
          localStorage.removeItem("quizx_user");
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth token validation expired", err);
        localStorage.removeItem("quizx_token");
        localStorage.removeItem("quizx_user");
        setUser(null);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1c1f58] rounded-full animate-spin" />
        <span className="text-xs font-bold text-[#1c1f58] tracking-wide">
          Connecting to QuizX Portal...
        </span>
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";
  const isFaculty = user?.role === "FACULTY" || user?.role === "COURSE_CREATOR" || user?.role === "SUBADMIN";
  const isStudent = user?.role === "STUDENT";

  const getRoleHomePath = () => {
    if (isAdmin) return "/admin";
    if (isFaculty) return "/faculty";
    return "/student";
  };

  return (
    <Routes>
      {/* 1. Public Front Gateway: College Registration & Candidate/Admin Login */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <AuthLanding
              onLoginSuccess={(u, shouldNavigate = true) => {
                setUser(u);
                if (shouldNavigate) {
                  if (u.role === "ADMIN") navigate("/admin", { replace: true });
                  else if (u.role === "FACULTY" || u.role === "COURSE_CREATOR" || u.role === "SUBADMIN") navigate("/faculty", { replace: true });
                  else navigate("/student", { replace: true });
                }
              }}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <AuthLanding
              onLoginSuccess={(u, shouldNavigate = true) => {
                setUser(u);
                if (shouldNavigate) {
                  if (u.role === "ADMIN") navigate("/admin", { replace: true });
                  else if (u.role === "FACULTY" || u.role === "COURSE_CREATOR" || u.role === "SUBADMIN") navigate("/faculty", { replace: true });
                  else navigate("/student", { replace: true });
                }
              }}
            />
          )
        }
      />

      {/* 2. Root Gateway */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <AuthLanding
              onLoginSuccess={(u, shouldNavigate = true) => {
                setUser(u);
                if (shouldNavigate) {
                  if (u.role === "ADMIN") navigate("/admin", { replace: true });
                  else if (u.role === "FACULTY" || u.role === "COURSE_CREATOR" || u.role === "SUBADMIN") navigate("/faculty", { replace: true });
                  else navigate("/student", { replace: true });
                }
              }}
            />
          )
        }
      />

      {/* 3. Authentic QuizX Student Assessment Portal */}
      <Route
        path="/student"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !isStudent && !isAdmin ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <PortalLayout
              user={user}
              activeTab={activeTab}
              onTabChange={(tabId) => setActiveTab(tabId)}
            >
              <StudentDashboard
                user={user}
                activeTab={activeTab}
                onTabChange={(tabId) => setActiveTab(tabId)}
              />
            </PortalLayout>
          )
        }
      />

      {/* 4. Authentic QuizX Live Assessment Room (Proctored Examination Engine) */}
      <Route
        path="/quiz/:id/take"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <TakeQuiz user={user} />
          )
        }
      />

      {/* 5. Authentic QuizX Evaluated Gradebook / Results */}
      <Route
        path="/quiz/:id/results"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <PortalLayout
              user={user}
              activeTab={activeTab}
              onTabChange={(tabId) => {
                setActiveTab(tabId);
                navigate(getRoleHomePath());
              }}
            >
              <QuizResults user={user} />
            </PortalLayout>
          )
        }
      />

      {/* 6. Authentic QuizX Faculty & Lab Invigilator Portal */}
      <Route
        path="/faculty"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !isFaculty && !isAdmin ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <PortalLayout
              user={user}
              activeTab={activeTab}
              onTabChange={(tabId) => setActiveTab(tabId)}
            >
              <FacultyDashboard
                user={user}
                activeTab={activeTab}
                onTabChange={(tabId) => setActiveTab(tabId)}
              />
            </PortalLayout>
          )
        }
      />
      {/* Backward compatible route alias */}
      <Route
        path="/subadmin"
        element={
          <Navigate to="/faculty" replace />
        }
      />

      {/* 7. Authentic QuizX Super Admin Governance Portal */}
      <Route
        path="/admin"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !isAdmin ? (
            <Navigate to={getRoleHomePath()} replace />
          ) : (
            <PortalLayout
              user={user}
              activeTab={activeTab}
              onTabChange={(tabId) => setActiveTab(tabId)}
            >
              <AdminDashboard
                user={user}
                activeTab={activeTab}
                onTabChange={(tabId) => setActiveTab(tabId)}
              />
            </PortalLayout>
          )
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
