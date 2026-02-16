import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import Dashboard from "@/pages/Dashboard";
import CheckIn from "@/pages/CheckIn";
import CheckOut from "@/pages/CheckOut";
import VisitorLog from "@/pages/VisitorLog";
import Admin from "@/pages/Admin";
import { LayoutDashboard, UserPlus, LogOut, ClipboardList, Settings } from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/checkin", label: "Check In", icon: UserPlus },
  { path: "/checkout", label: "Check Out", icon: LogOut },
  { path: "/log", label: "Log", icon: ClipboardList },
  { path: "/admin", label: "Admin", icon: Settings },
];

function NavBar() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" data-testid="main-navigation">
      <div className="flex items-center justify-around max-w-3xl mx-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
              className={`flex flex-col items-center justify-center py-3 px-4 min-w-[72px] transition-all duration-200 ${
                isActive
                  ? "text-blue-600 border-t-3 border-blue-600 bg-blue-50/60"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs mt-1 font-semibold tracking-wide ${isActive ? 'text-blue-700' : ''}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function AppContent() {
  useEffect(() => {
    api.seed().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/checkout" element={<CheckOut />} />
        <Route path="/log" element={<VisitorLog />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <NavBar />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
