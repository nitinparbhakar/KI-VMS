import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LogOut, Search, Clock, User, Phone, Building2, Check, X } from "lucide-react";

export default function CheckOut() {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutDialog, setCheckoutDialog] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchActive = async () => {
    try {
      const res = await api.getActiveVisitors();
      setActiveVisitors(res.data.visitors);
      setFiltered(res.data.visitors);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActive(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(activeVisitors);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(activeVisitors.filter(v =>
      v.name?.toLowerCase().includes(q) ||
      v.phone?.includes(q) ||
      v.visitor_id?.toLowerCase().includes(q) ||
      v.company?.toLowerCase().includes(q)
    ));
  }, [search, activeVisitors]);

  const handleCheckout = async () => {
    if (!checkoutDialog) return;
    setProcessing(true);
    try {
      await api.checkout(checkoutDialog.visitor_id);
      toast.success(`${checkoutDialog.name} checked out successfully`);
      setCheckoutDialog(null);
      fetchActive();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  const getDuration = (inTime) => {
    const diff = Date.now() - new Date(inTime).getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="page-enter min-h-screen" data-testid="checkout-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <LogOut className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="font-heading font-black text-lg tracking-tight uppercase">Visitor Check-Out</h1>
            <p className="text-slate-400 text-xs">Search and punch out visitors</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="relative mb-6" data-testid="checkout-search">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, visitor ID..."
            data-testid="checkout-search-input"
            className="h-16 text-xl pl-12 bg-white shadow-md border-0 ring-1 ring-slate-100 focus:ring-2 focus:ring-blue-500 rounded-full"
          />
        </div>

        {/* Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
            {filtered.length} Active Visitor{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Visitor Cards */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100" data-testid="no-visitors-checkout">
            <LogOut className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-body text-sm">
              {search ? "No matching visitors found" : "No active visitors to check out"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(v => (
              <div
                key={v.visitor_id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all"
                data-testid={`checkout-visitor-${v.visitor_id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-heading font-bold text-lg">
                      {v.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-body font-semibold text-slate-900 text-base truncate">{v.name}</h3>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold px-2">IN</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</span>
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{v.department}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />Host: {v.host_name}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Duration: {getDuration(v.in_time)}</span>
                    </div>
                    <p className="font-mono text-[10px] text-blue-600 mt-1.5">{v.visitor_id}</p>
                  </div>
                  <button
                    onClick={() => setCheckoutDialog(v)}
                    data-testid={`checkout-btn-${v.visitor_id}`}
                    className="h-14 px-6 bg-slate-900 text-white rounded-xl font-heading font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 flex-shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                    OUT
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={!!checkoutDialog} onOpenChange={() => setCheckoutDialog(null)}>
        <DialogContent className="max-w-sm" data-testid="checkout-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-xl text-center">CONFIRM CHECK-OUT</DialogTitle>
            <DialogDescription className="text-center text-slate-500">
              Are you sure you want to check out this visitor?
            </DialogDescription>
          </DialogHeader>
          {checkoutDialog && (
            <div className="py-4">
              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                <p className="font-body font-semibold text-slate-900">{checkoutDialog.name}</p>
                <p className="text-sm text-slate-500">{checkoutDialog.phone}</p>
                <p className="font-mono text-xs text-blue-600">{checkoutDialog.visitor_id}</p>
                <p className="text-xs text-slate-400">
                  In since: {new Date(checkoutDialog.in_time).toLocaleTimeString('en-IN')} ({getDuration(checkoutDialog.in_time)})
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCheckoutDialog(null)}
                  data-testid="cancel-checkout-btn"
                  className="flex-1 h-14 border-2 border-slate-200 rounded-xl font-heading font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> CANCEL
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  data-testid="confirm-checkout-btn"
                  className="flex-1 h-14 bg-slate-900 text-white rounded-xl font-heading font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Check className="w-4 h-4" /> CHECK OUT</>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
