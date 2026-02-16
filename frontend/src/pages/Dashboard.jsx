import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, LogOut, Clock, ArrowRight, Shield } from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_workforce-entry-1/artifacts/tsvym70d_king_logo_9-removebg-preview.png";

export default function Dashboard() {
  const [stats, setStats] = useState({ active_visitors: 0, today_visitors: 0, today_checkouts: 0, total_visitors: 0 });
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [statsRes, visitorsRes] = await Promise.all([
        api.getStats(),
        api.getActiveVisitors()
      ]);
      setStats(statsRes.data);
      setActiveVisitors(visitorsRes.data.visitors);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: "ACTIVE NOW", value: stats.active_visitors, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", pulse: stats.active_visitors > 0 },
    { label: "TODAY IN", value: stats.today_visitors, icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "TODAY OUT", value: stats.today_checkouts, icon: LogOut, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "ALL TIME", value: stats.total_visitors, icon: Clock, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  ];

  return (
    <div className="page-enter industrial-grid min-h-screen" data-testid="dashboard-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <img src={LOGO_URL} alt="King Group" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-black text-xl tracking-tight uppercase" data-testid="dashboard-title">
                King Group
              </h1>
              <p className="text-slate-400 text-xs font-body font-medium tracking-widest uppercase">
                Visitor Management System
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-300 font-mono">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {new Date().toLocaleTimeString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="stats-grid">
          {statCards.map(({ label, value, icon: Icon, color, bg, border, pulse }) => (
            <div
              key={label}
              className={`${bg} border ${border} rounded-xl p-5 transition-all hover:shadow-md`}
              data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${color}`} />
                {pulse && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />}
              </div>
              <p className={`text-3xl font-heading font-black ${color}`}>{loading ? "..." : value}</p>
              <p className="text-[10px] font-body font-semibold text-slate-500 tracking-[0.15em] uppercase mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate("/checkin")}
            data-testid="quick-checkin-btn"
            className="h-28 flex items-center justify-center gap-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 group"
          >
            <UserPlus className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <span className="text-xl font-heading font-black tracking-tight block">CHECK IN</span>
              <span className="text-blue-200 text-xs font-medium">New Visitor Entry</span>
            </div>
            <ArrowRight className="w-5 h-5 ml-2 opacity-60 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate("/checkout")}
            data-testid="quick-checkout-btn"
            className="h-28 flex items-center justify-center gap-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 group"
          >
            <LogOut className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <span className="text-xl font-heading font-black tracking-tight block">CHECK OUT</span>
              <span className="text-slate-400 text-xs font-medium">Visitor Exit</span>
            </div>
            <ArrowRight className="w-5 h-5 ml-2 opacity-60 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Active Visitors */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm" data-testid="active-visitors-section">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-slate-900 text-lg tracking-tight">ACTIVE VISITORS</h2>
              <p className="text-xs text-slate-500 font-body mt-0.5">Currently inside premises</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-sm font-bold px-3 py-1">
              {activeVisitors.length} INSIDE
            </Badge>
          </div>

          {activeVisitors.length === 0 ? (
            <div className="p-12 text-center" data-testid="no-active-visitors">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-body text-sm">No active visitors at this time</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {activeVisitors.map((v) => (
                <div key={v.visitor_id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center gap-4" data-testid={`active-visitor-${v.visitor_id}`}>
                  <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-heading font-bold text-sm">
                      {v.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-slate-900 text-sm truncate">{v.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {v.company ? `${v.company} · ` : ''}{v.department} · Host: {v.host_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-xs text-blue-600 font-medium">{v.visitor_id}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      In: {new Date(v.in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
