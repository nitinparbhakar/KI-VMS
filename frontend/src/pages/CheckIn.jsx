import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, RefreshCw, UserPlus, Building2, Phone, User, Briefcase, Target, Check, X, FileText, AlertTriangle, History, ShieldAlert } from "lucide-react";

const PURPOSE_OPTIONS = ["Meeting", "Interview", "Delivery", "Vendor Visit", "Personal", "Audit", "Maintenance", "Other"];
const LOGO_URL = "/logo.png";

export default function CheckIn() {
  const webcamRef = useRef(null);
  const phoneInputRef = useRef(null);
  const [departments, setDepartments] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [phoneLookup, setPhoneLookup] = useState(null); // { found, name, company, visits, blacklisted }
  const [lookingUp, setLookingUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [phoneEntered, setPhoneEntered] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", company: "", purpose: "", department: "", host_id: "", host_name: "", host_email: ""
  });

  useEffect(() => {
    api.getDepartments().then(r => setDepartments(r.data.departments)).catch(() => {});
    // Focus phone input on mount
    setTimeout(() => phoneInputRef.current?.focus(), 300);

    // Enumerate video devices to enable camera switching
    const getDevices = async () => {
      try {
        // Request camera permission first so labels are available
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === "videoinput");
        setVideoDevices(cameras);
        // Try to default to back camera
        const backCamera = cameras.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        );
        if (backCamera) {
          setSelectedDeviceId(backCamera.deviceId);
        }
      } catch (e) {
        console.log("Camera enumeration failed:", e);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (form.department) {
      api.getHosts(form.department).then(r => setHosts(r.data.hosts)).catch(() => {});
      setForm(f => ({ ...f, host_id: "", host_name: "", host_email: "" }));
    }
  }, [form.department]);

  // Phone lookup with debounce
  useEffect(() => {
    const cleaned = form.phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setPhoneLookup(null);
      setPhoneEntered(false);
      return;
    }
    setPhoneEntered(true);
    const timer = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await api.lookupPhone(form.phone);
        setPhoneLookup(res.data);
        if (res.data.found) {
          setForm(f => ({
            ...f,
            name: f.name || res.data.name || "",
            company: f.company || res.data.company || ""
          }));
          toast.info(`Returning visitor detected! Visit #${res.data.visit_count + 1}`);
        }
        if (res.data.blacklisted) {
          toast.error(`BLACKLISTED VISITOR! ${res.data.blacklist_reason || ''}`);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLookingUp(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.phone]);

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const photo = webcamRef.current.getScreenshot();
      if (photo) {
        setCapturedPhoto(photo);
        toast.success("Photo captured!");
      } else {
        toast.error("Failed to capture. Check camera access.");
      }
    }
  }, []);

  const retakePhoto = () => setCapturedPhoto(null);

  const toggleCamera = () => {
    setCameraReady(false);
    if (videoDevices.length > 1) {
      // Cycle through available cameras by device ID
      const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      setSelectedDeviceId(videoDevices[nextIndex].deviceId);
    }
    // Also toggle facingMode as fallback
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const selectHost = (hostId) => {
    const host = hosts.find(h => h.id === hostId);
    if (host) {
      setForm(f => ({ ...f, host_id: host.id, host_name: host.name, host_email: host.email }));
    }
  };

  const handleSubmit = async () => {
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) return toast.error("Valid phone number required (10 digits)");
    if (phoneLookup?.blacklisted) return toast.error("Cannot check in a BLACKLISTED visitor!");
    if (!form.name.trim()) return toast.error("Visitor name is required");
    if (!form.purpose) return toast.error("Purpose of visit is required");
    if (!form.department) return toast.error("Department is required");
    if (!form.host_id) return toast.error("Host person is required");
    if (!capturedPhoto) return toast.error("Photo is MANDATORY. Please capture visitor photo.");

    setSubmitting(true);
    try {
      const res = await api.checkin({ ...form, photo: capturedPhoto });
      setSuccess(res.data);
      toast.success("Visitor checked in successfully!");
    } catch (e) {
      const detail = e.response?.data?.detail || "Check-in failed";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", company: "", purpose: "", department: "", host_id: "", host_name: "", host_email: "" });
    setCapturedPhoto(null);
    setSuccess(null);
    setPhoneLookup(null);
    setPhoneEntered(false);
    setCameraReady(false);
    setFacingMode("environment");
    setSelectedDeviceId(null);
    setTimeout(() => phoneInputRef.current?.focus(), 300);
  };

  // Success screen
  if (success) {
    const v = success.visitor;
    return (
      <div className="page-enter min-h-screen flex items-center justify-center p-6" data-testid="checkin-success">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="font-heading font-black text-2xl text-slate-900 mb-2">CHECKED IN</h2>
          <p className="text-slate-500 font-body text-sm mb-6">Visitor has been registered successfully</p>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
            <p className="text-xs text-blue-500 font-semibold tracking-widest uppercase mb-1">Visitor ID</p>
            <p className="font-mono text-2xl text-blue-700 font-bold" data-testid="checkin-visitor-id">{v.visitor_id}</p>
          </div>

          <div className="text-left space-y-2 mb-6">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Name</span>
              <span className="text-slate-900 font-semibold text-sm">{v.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Host</span>
              <span className="text-slate-900 font-semibold text-sm">{v.host_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Department</span>
              <span className="text-slate-900 font-semibold text-sm">{v.department}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 text-sm">Email sent to</span>
              <span className="text-blue-600 font-semibold text-sm">{v.host_email}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href={api.getVisitorSlipUrl(v.visitor_id)}
              target="_blank"
              rel="noreferrer"
              data-testid="print-slip-btn"
              className="flex-1 h-14 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl font-heading font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
            >
              <FileText className="w-5 h-5" />
              PRINT SLIP
            </a>
            <button
              onClick={resetForm}
              data-testid="new-checkin-btn"
              className="flex-1 h-14 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-heading font-bold text-sm hover:bg-blue-700 transition-all active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              NEW ENTRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter min-h-screen" data-testid="checkin-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <img src={LOGO_URL} alt="King Group" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="font-heading font-black text-lg tracking-tight uppercase">Visitor Check-In</h1>
            <p className="text-slate-400 text-xs">King Group - Capture photo & register visitor</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Camera Section */}
          <div className="lg:col-span-5" data-testid="camera-section">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-blue-600" />
                <h3 className="font-heading font-bold text-slate-900 text-sm tracking-tight uppercase">
                  Live Photo Capture
                </h3>
                {!capturedPhoto && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] ml-auto">REQUIRED</Badge>
                )}
                {capturedPhoto && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] ml-auto">CAPTURED</Badge>
                )}
              </div>

              <div className="aspect-[4/3] bg-slate-900 rounded-xl overflow-hidden relative">
                {capturedPhoto ? (
                  <img
                    src={capturedPhoto}
                    alt="Captured visitor"
                    className="w-full h-full object-cover"
                    data-testid="captured-photo-preview"
                  />
                ) : (
                  <Webcam
                    key={selectedDeviceId || facingMode}
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.7}
                    videoConstraints={selectedDeviceId
                      ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 }
                      : { facingMode: { ideal: facingMode }, width: 640, height: 480 }
                    }
                    onUserMedia={() => setCameraReady(true)}
                    onUserMediaError={() => {
                      toast.error("Camera access denied. Please allow camera.");
                      // Fallback: clear deviceId and try facingMode
                      if (selectedDeviceId) {
                        setSelectedDeviceId(null);
                      }
                    }}
                    className="w-full h-full object-cover"
                    data-testid="camera-feed"
                  />
                )}
                {!capturedPhoto && !cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2 animate-pulse" />
                      <p className="text-slate-500 text-sm">Initializing camera...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                {capturedPhoto ? (
                  <button
                    onClick={retakePhoto}
                    data-testid="retake-photo-btn"
                    className="flex-1 h-14 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-heading font-bold text-sm hover:border-slate-400 transition-all active:scale-95"
                  >
                    <RefreshCw className="w-5 h-5" />
                    RETAKE
                  </button>
                ) : (
                  <>
                    {videoDevices.length > 1 && (
                      <button
                        onClick={toggleCamera}
                        data-testid="switch-camera-btn"
                        className="h-14 px-4 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-slate-400 transition-all active:scale-95 flex-shrink-0"
                        title={facingMode === "user" ? "Switch to back camera" : "Switch to front camera"}
                      >
                        <RefreshCw className="w-5 h-5" />
                        <span className="text-xs font-semibold hidden sm:inline">FLIP</span>
                      </button>
                    )}
                    <button
                      onClick={capturePhoto}
                      disabled={!cameraReady}
                      data-testid="capture-photo-btn"
                      className="flex-1 h-14 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-heading font-bold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                    >
                      <Camera className="w-5 h-5" />
                      CAPTURE PHOTO
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-7" data-testid="checkin-form-section">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-heading font-bold text-slate-900 text-sm tracking-tight uppercase mb-5">
                Visitor Details
              </h3>

              <div className="space-y-4">
                {/* PHONE FIRST */}
                <div>
                  <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                    <Phone className="w-3.5 h-3.5" /> Mobile Number <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-400 font-normal ml-1">(Enter first to check returning visitor)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      ref={phoneInputRef}
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="10-digit mobile number"
                      type="tel"
                      data-testid="input-phone"
                      className={`h-14 text-lg border-2 rounded-lg pr-12 ${
                        phoneLookup?.blacklisted ? 'border-red-500 bg-red-50' :
                        phoneLookup?.found ? 'border-emerald-500 bg-emerald-50' :
                        'border-slate-200 focus:border-blue-600'
                      }`}
                    />
                    {lookingUp && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Blacklisted Warning */}
                {phoneLookup?.blacklisted && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3" data-testid="blacklist-warning">
                    <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-heading font-bold text-red-800 text-sm">BLACKLISTED VISITOR</p>
                      <p className="text-red-600 text-xs mt-1">
                        {phoneLookup.blacklist_name && <span className="font-semibold">{phoneLookup.blacklist_name}: </span>}
                        {phoneLookup.blacklist_reason || "This number is blocked from entry."}
                      </p>
                      <p className="text-red-500 text-xs mt-1 font-semibold">Check-in is NOT allowed for this visitor.</p>
                    </div>
                  </div>
                )}

                {/* Returning Visitor Badge */}
                {phoneLookup?.found && !phoneLookup?.blacklisted && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3" data-testid="returning-visitor-info">
                    <History className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading font-bold text-emerald-800 text-sm">RETURNING VISITOR</p>
                        <Badge className="bg-emerald-200 text-emerald-900 border-emerald-300 text-[10px]">
                          Visit #{phoneLookup.visit_count + 1}
                        </Badge>
                      </div>
                      <p className="text-emerald-700 text-xs mt-1">
                        Name & company auto-filled from previous visit.
                      </p>
                      <button
                        onClick={() => setShowHistory(true)}
                        data-testid="view-history-btn"
                        className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      >
                        <History className="w-3 h-3" /> View Previous Visits ({phoneLookup.visit_count})
                      </button>
                    </div>
                  </div>
                )}

                {/* Name & Company - shown after phone is entered */}
                {phoneEntered && !phoneLookup?.blacklisted && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                          <User className="w-3.5 h-3.5" /> Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Visitor full name"
                          data-testid="input-name"
                          className="h-14 text-lg border-2 border-slate-200 focus:border-blue-600 rounded-lg"
                        />
                      </div>
                      <div>
                        <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Company
                        </Label>
                        <Input
                          value={form.company}
                          onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                          placeholder="Company / Organization"
                          data-testid="input-company"
                          className="h-14 text-lg border-2 border-slate-200 focus:border-blue-600 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Purpose */}
                    <div>
                      <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                        <Target className="w-3.5 h-3.5" /> Purpose <span className="text-red-500">*</span>
                      </Label>
                      <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
                        <SelectTrigger className="h-14 text-lg border-2 border-slate-200" data-testid="select-purpose">
                          <SelectValue placeholder="Select purpose of visit" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURPOSE_OPTIONS.map(p => (
                            <SelectItem key={p} value={p} className="text-base py-3">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Department -> Host Cascade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                          <Briefcase className="w-3.5 h-3.5" /> Department <span className="text-red-500">*</span>
                        </Label>
                        <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                          <SelectTrigger className="h-14 text-lg border-2 border-slate-200" data-testid="select-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map(d => (
                              <SelectItem key={d} value={d} className="text-base py-3">{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="font-body font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1.5">
                          <User className="w-3.5 h-3.5" /> Host Person <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={form.host_id}
                          onValueChange={selectHost}
                          disabled={!form.department}
                        >
                          <SelectTrigger className="h-14 text-lg border-2 border-slate-200" data-testid="select-host">
                            <SelectValue placeholder={form.department ? "Select host" : "Select department first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {hosts.map(h => (
                              <SelectItem key={h.id} value={h.id} className="text-base py-3">
                                {h.name}
                              </SelectItem>
                            ))}
                            {hosts.length === 0 && form.department && (
                              <div className="p-3 text-sm text-slate-400 text-center">No hosts in this department</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Submit */}
              {phoneEntered && !phoneLookup?.blacklisted && (
                <div className="mt-6 pt-5 border-t border-slate-100">
                  {!capturedPhoto && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2" data-testid="photo-required-warning">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-red-700 text-sm font-medium">Photo capture is mandatory before submitting</p>
                    </div>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !capturedPhoto}
                    data-testid="submit-checkin-btn"
                    className="w-full h-16 flex items-center justify-center gap-3 bg-blue-600 text-white rounded-xl font-heading font-black text-lg tracking-tight hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    {submitting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-6 h-6" />
                        REGISTER VISITOR
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Previous Visits History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="history-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-lg">PREVIOUS VISITS</DialogTitle>
            <DialogDescription>Visit history for {phoneLookup?.name || form.phone}</DialogDescription>
          </DialogHeader>
          {phoneLookup?.visits && (
            <div className="space-y-3 pt-2">
              {phoneLookup.visits.map((v, i) => (
                <div key={v.visitor_id} className="bg-slate-50 rounded-xl p-4 border border-slate-100" data-testid={`history-visit-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-blue-600 font-medium">{v.visitor_id}</span>
                    <Badge className={`text-[10px] font-bold px-2 ${v.status === "IN" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {v.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">Purpose:</span> <span className="text-slate-700 font-medium">{v.purpose}</span></div>
                    <div><span className="text-slate-400">Host:</span> <span className="text-slate-700 font-medium">{v.host_name}</span></div>
                    <div><span className="text-slate-400">Dept:</span> <span className="text-slate-700 font-medium">{v.department}</span></div>
                    <div><span className="text-slate-400">In:</span> <span className="text-slate-700 font-medium">{new Date(v.in_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
