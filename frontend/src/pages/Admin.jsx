import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, UserPlus, Users, Mail, ScrollText, Pencil, Trash2, Plus, X, Check, Phone, Building2 } from "lucide-react";

export default function Admin() {
  const [hosts, setHosts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [emailLog, setEmailLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostDialog, setHostDialog] = useState(null); // null=closed, {}=add, {id:...}=edit
  const [hostForm, setHostForm] = useState({ name: "", email: "", department: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState("all");

  const fetchAll = async () => {
    try {
      const [hostsRes, deptRes, auditRes, emailRes] = await Promise.all([
        api.getHosts(null),
        api.getDepartments(),
        api.getAuditLog(1),
        api.getEmailLog()
      ]);
      setHosts(hostsRes.data.hosts);
      setDepartments(deptRes.data.departments);
      setAuditLog(auditRes.data.logs);
      setEmailLog(emailRes.data.emails);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAddHost = () => {
    setHostForm({ name: "", email: "", department: "", phone: "" });
    setHostDialog({});
  };

  const openEditHost = (host) => {
    setHostForm({ name: host.name, email: host.email, department: host.department, phone: host.phone || "" });
    setHostDialog(host);
  };

  const saveHost = async () => {
    if (!hostForm.name.trim() || !hostForm.email.trim() || !hostForm.department) {
      return toast.error("Name, email, and department are required");
    }
    setSaving(true);
    try {
      if (hostDialog.id) {
        await api.updateHost(hostDialog.id, hostForm);
        toast.success("Host updated");
      } else {
        await api.createHost({ ...hostForm, active: true });
        toast.success("Host added");
      }
      setHostDialog(null);
      fetchAll();
    } catch (e) {
      toast.error("Failed to save host");
    } finally {
      setSaving(false);
    }
  };

  const deleteHost = async (id, name) => {
    if (!window.confirm(`Remove ${name} from hosts?`)) return;
    try {
      await api.deleteHost(id);
      toast.success("Host removed");
      fetchAll();
    } catch (e) {
      toast.error("Failed to delete host");
    }
  };

  const filteredHosts = filterDept === "all" ? hosts : hosts.filter(h => h.department === filterDept);

  return (
    <div className="page-enter min-h-screen" data-testid="admin-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Settings className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="font-heading font-black text-lg tracking-tight uppercase">Admin Panel</h1>
            <p className="text-slate-400 text-xs">Manage hosts, view logs & emails</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="hosts" className="space-y-6" data-testid="admin-tabs">
          <TabsList className="h-12 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <TabsTrigger value="hosts" className="h-10 px-5 rounded-lg font-heading font-bold text-xs tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-hosts">
              <Users className="w-4 h-4 mr-2" /> HOSTS
            </TabsTrigger>
            <TabsTrigger value="audit" className="h-10 px-5 rounded-lg font-heading font-bold text-xs tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-audit">
              <ScrollText className="w-4 h-4 mr-2" /> AUDIT LOG
            </TabsTrigger>
            <TabsTrigger value="emails" className="h-10 px-5 rounded-lg font-heading font-bold text-xs tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-emails">
              <Mail className="w-4 h-4 mr-2" /> EMAILS
            </TabsTrigger>
          </TabsList>

          {/* Hosts Tab */}
          <TabsContent value="hosts">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger className="w-48 h-10 border-slate-200 rounded-lg" data-testid="filter-department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-mono text-xs">{filteredHosts.length} hosts</Badge>
                </div>
                <button
                  onClick={openAddHost}
                  data-testid="add-host-btn"
                  className="h-10 px-5 bg-blue-600 text-white rounded-lg font-heading font-bold text-xs tracking-wider hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> ADD HOST
                </button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Name</TableHead>
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Email</TableHead>
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Department</TableHead>
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase hidden sm:table-cell">Phone</TableHead>
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase">Status</TableHead>
                    <TableHead className="font-heading font-bold text-[10px] tracking-widest text-slate-500 uppercase w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHosts.map(h => (
                    <TableRow key={h.id} data-testid={`host-row-${h.id}`}>
                      <TableCell className="font-semibold text-slate-900 text-sm">{h.name}</TableCell>
                      <TableCell className="text-sm text-blue-600">{h.email}</TableCell>
                      <TableCell className="text-sm text-slate-600">{h.department}</TableCell>
                      <TableCell className="text-sm text-slate-500 hidden sm:table-cell">{h.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 ${h.active ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                          {h.active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEditHost(h)} data-testid={`edit-host-${h.id}`} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteHost(h.id, h.name)} data-testid={`delete-host-${h.id}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm" data-testid="audit-log-section">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-heading font-bold text-sm tracking-tight uppercase text-slate-900">Audit Trail</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {auditLog.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No audit entries yet</div>
                ) : (
                  auditLog.map((log, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50/60 transition-colors flex items-start gap-3" data-testid={`audit-entry-${i}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.action === "CHECK_IN" ? "bg-emerald-100" : "bg-amber-100"}`}>
                        {log.action === "CHECK_IN" ? (
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Settings className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 font-medium">{log.details}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-mono text-[10px] text-blue-600">{log.visitor_id}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <Badge className={`text-[10px] font-bold px-2 ${log.action === "CHECK_IN" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                        {log.action}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm" data-testid="email-log-section">
              <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                <h3 className="font-heading font-bold text-sm tracking-tight uppercase text-slate-900">Email Notifications</h3>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold ml-2">MOCKED</Badge>
              </div>
              <div className="divide-y divide-slate-50">
                {emailLog.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No emails sent yet</div>
                ) : (
                  emailLog.map((e, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50/60 transition-colors" data-testid={`email-entry-${i}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-slate-900">{e.subject}</span>
                      </div>
                      <p className="text-xs text-slate-500 ml-6">To: {e.to}</p>
                      <p className="text-xs text-slate-400 ml-6 mt-1">{e.body}</p>
                      <div className="flex items-center gap-2 ml-6 mt-2">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">{e.status}</Badge>
                        <span className="text-[10px] text-slate-400">{new Date(e.sent_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Host Dialog */}
      <Dialog open={hostDialog !== null} onOpenChange={() => setHostDialog(null)}>
        <DialogContent className="max-w-md" data-testid="host-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-lg">
              {hostDialog?.id ? "EDIT HOST" : "ADD NEW HOST"}
            </DialogTitle>
            <DialogDescription>
              {hostDialog?.id ? "Update host details" : "Add a new employee as a host"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="font-body font-semibold text-sm mb-1.5 block">Name *</Label>
              <Input
                value={hostForm.name}
                onChange={e => setHostForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Employee full name"
                data-testid="host-input-name"
                className="h-12 border-2 border-slate-200"
              />
            </div>
            <div>
              <Label className="font-body font-semibold text-sm mb-1.5 block">Email *</Label>
              <Input
                value={hostForm.email}
                onChange={e => setHostForm(f => ({ ...f, email: e.target.value }))}
                placeholder="employee@kinggroup.in"
                type="email"
                data-testid="host-input-email"
                className="h-12 border-2 border-slate-200"
              />
            </div>
            <div>
              <Label className="font-body font-semibold text-sm mb-1.5 block">Department *</Label>
              <Select value={hostForm.department} onValueChange={v => setHostForm(f => ({ ...f, department: v }))}>
                <SelectTrigger className="h-12 border-2 border-slate-200" data-testid="host-select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body font-semibold text-sm mb-1.5 block">Phone</Label>
              <Input
                value={hostForm.phone}
                onChange={e => setHostForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Optional phone number"
                data-testid="host-input-phone"
                className="h-12 border-2 border-slate-200"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setHostDialog(null)}
                className="flex-1 h-12 border-2 border-slate-200 rounded-xl font-heading font-bold text-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> CANCEL
              </button>
              <button
                onClick={saveHost}
                disabled={saving}
                data-testid="save-host-btn"
                className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-heading font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Check className="w-4 h-4" /> SAVE</>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
