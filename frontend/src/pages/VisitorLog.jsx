import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Search, Filter, ChevronLeft, ChevronRight, Eye, FileText, Phone, User, Building2, Clock } from "lucide-react";

export default function VisitorLog() {
  const [visitors, setVisitors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [visitorPhoto, setVisitorPhoto] = useState(null);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search.trim()) {
        if (search.match(/^\d/)) params.phone = search;
        else if (search.startsWith("VIS")) params.visitor_id = search;
        else params.name = search;
      }
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.searchVisitors(params);
      setVisitors(res.data.visitors);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVisitors(); }, [page, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchVisitors(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const viewDetails = async (v) => {
    setSelectedVisitor(v);
    setVisitorPhoto(null);
    try {
      const res = await api.getVisitorPhoto(v.visitor_id);
      setVisitorPhoto(res.data.photo);
    } catch (e) { /* no photo */ }
  };

  return (
    <div className="page-enter min-h-screen" data-testid="visitor-log-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="font-heading font-black text-lg tracking-tight uppercase">Visitor Log</h1>
            <p className="text-slate-400 text-xs">Complete visitor history & records</p>
          </div>
          <div className="ml-auto">
            <Badge className="bg-white/10 text-white border-white/20 font-mono text-xs">{total} Records</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search & Filters */}
        <div className="flex gap-3 mb-6" data-testid="log-filters">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, visitor ID..."
              data-testid="log-search-input"
              className="h-14 pl-12 text-base border-2 border-slate-200 focus:border-blue-600 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40 h-14 border-2 border-slate-200 rounded-xl" data-testid="log-status-filter">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="IN">Checked In</SelectItem>
              <SelectItem value="OUT">Checked Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" data-testid="visitor-log-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">ID</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Visitor</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase hidden sm:table-cell">Phone</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase hidden md:table-cell">Department</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase hidden md:table-cell">Host</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">In Time</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Status</TableHead>
                <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : visitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    No visitors found
                  </TableCell>
                </TableRow>
              ) : (
                visitors.map(v => (
                  <TableRow key={v.visitor_id} className="hover:bg-blue-50/30" data-testid={`log-row-${v.visitor_id}`}>
                    <TableCell className="font-mono text-xs text-blue-600 font-medium">{v.visitor_id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{v.name}</p>
                        <p className="text-xs text-slate-400">{v.company || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-slate-600">{v.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">{v.department}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">{v.host_name}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(v.in_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}<br />
                      {new Date(v.in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      {v.status === "IN" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold px-2 py-0.5">IN</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold px-2 py-0.5">OUT</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => viewDetails(v)}
                        data-testid={`view-visitor-${v.visitor_id}`}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">Page {page} of {pages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="log-prev-page"
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  data-testid="log-next-page"
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visitor Detail Dialog */}
      <Dialog open={!!selectedVisitor} onOpenChange={() => setSelectedVisitor(null)}>
        <DialogContent className="max-w-md" data-testid="visitor-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-lg">VISITOR DETAILS</DialogTitle>
            <DialogDescription className="text-slate-500">
              {selectedVisitor?.visitor_id}
            </DialogDescription>
          </DialogHeader>
          {selectedVisitor && (
            <div className="space-y-4">
              {visitorPhoto && (
                <div className="w-24 h-24 rounded-xl overflow-hidden mx-auto border-2 border-slate-200" data-testid="detail-visitor-photo">
                  <img src={visitorPhoto} alt={selectedVisitor.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-2">
                {[
                  { icon: User, label: "Name", value: selectedVisitor.name },
                  { icon: Phone, label: "Phone", value: selectedVisitor.phone },
                  { icon: Building2, label: "Company", value: selectedVisitor.company || "N/A" },
                  { icon: Building2, label: "Department", value: selectedVisitor.department },
                  { icon: User, label: "Host", value: selectedVisitor.host_name },
                  { icon: Clock, label: "Check-In", value: new Date(selectedVisitor.in_time).toLocaleString('en-IN') },
                  { icon: Clock, label: "Check-Out", value: selectedVisitor.out_time ? new Date(selectedVisitor.out_time).toLocaleString('en-IN') : "Still Inside" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{label}</span>
                    <span className="text-sm text-slate-900 font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <a
                href={api.getVisitorSlipUrl(selectedVisitor.visitor_id)}
                target="_blank"
                rel="noreferrer"
                data-testid="detail-print-slip-btn"
                className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl font-heading font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
                DOWNLOAD PDF SLIP
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
