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
import { Settings, UserPlus, Users, Mail, ScrollText, Pencil, Trash2, Plus, X, Check, ShieldAlert, ShieldOff } from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_workforce-entry-1/artifacts/tsvym70d_king_logo_9-removebg-preview.png";

export default function Admin() {

  const [hosts, setHosts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [emailLog, setEmailLog] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostDialog, setHostDialog] = useState(null);
  const [blacklistDialog, setBlacklistDialog] = useState(false);
  const [hostForm, setHostForm] = useState({ name: "", email: "", department: "", phone: "" });
  const [blacklistForm, setBlacklistForm] = useState({ phone: "", name: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState("all");

  const fetchAll = async () => {
    try {
      const [hostsRes, deptRes, auditRes, emailRes, blRes] = await Promise.all([
        api.getHosts(null),
        api.getDepartments(),
        api.getAuditLog(1),
        api.getEmailLog(),
        api.getBlacklist()
      ]);

      setHosts(hostsRes.data.hosts);
      setDepartments(deptRes.data.departments);
      setAuditLog(auditRes.data.logs);
      setEmailLog(emailRes.data.emails);
      setBlacklist(blRes.data.blacklist);

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
    setHostForm({
      name: host.name,
      email: host.email,
      department: host.department,
      phone: host.phone || ""
    });
    setHostDialog(host);
  };

  const saveHost = async () => {

    if (!hostForm.name.trim() || !hostForm.email.trim() || !hostForm.department) {
      return toast.error("Name, email, and department are required");
    }

    setSaving(true);

    try {
      if (hostDialog?._id) {
        await api.updateHost(hostDialog._id, hostForm);
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

  const filteredHosts =
    filterDept === "all"
      ? hosts
      : hosts.filter(h => h.department === filterDept);

  return (
    <div className="min-h-screen">

      <div className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <img src={LOGO_URL} alt="King Group" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="font-bold text-lg uppercase">Admin Panel</h1>
            <p className="text-slate-400 text-xs">Manage hosts</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        <div className="bg-white rounded-xl border shadow-sm">

          <div className="p-5 border-b flex items-center justify-between">

            <div className="flex items-center gap-3">
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-48 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge>{filteredHosts.length} hosts</Badge>
            </div>

            <button
              onClick={openAddHost}
              className="h-10 px-5 bg-blue-600 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> ADD HOST
            </button>

          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredHosts.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>{h.email}</TableCell>
                  <TableCell>{h.department}</TableCell>
                  <TableCell>
                    <Badge>{h.active ? "ACTIVE" : "INACTIVE"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button onClick={() => openEditHost(h)}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteHost(h.id, h.name)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </div>
      </div>

      <Dialog open={hostDialog !== null} onOpenChange={() => setHostDialog(null)}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              {hostDialog?._id ? "Edit Host" : "Add Host"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div>
              <Label>Name *</Label>
              <Input
                value={hostForm.name}
                onChange={e => setHostForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Email *</Label>
              <Input
                value={hostForm.email}
                onChange={e => setHostForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <Label>Department *</Label>
              <Select
                value={hostForm.department}
                onValueChange={v => setHostForm(f => ({ ...f, department: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setHostDialog(null)} className="flex-1 border rounded-lg h-10">
                Cancel
              </button>
              <button onClick={saveHost} className="flex-1 bg-blue-600 text-white rounded-lg h-10">
                Save
              </button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
