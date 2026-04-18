import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Plus, ShieldCheck, ShieldX } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/services/api";

interface Permission {
  id: string;
  code: string;
  domain: string;
  description?: string | null;
  risk_level: string;
}

interface Override {
  id: string;
  permission_id: string;
  effect: "allow" | "deny";
  reason?: string | null;
  expires_at?: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string | null;
  memberName: string;
}

export function MemberOverridesDialog({ open, onClose, memberId, memberName }: Props) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newPermId, setNewPermId] = useState<string>("");
  const [newEffect, setNewEffect] = useState<"allow" | "deny">("allow");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    if (!open || !memberId) return;
    void fetchData();
  }, [open, memberId]);

  const fetchData = async () => {
    if (!memberId) return;
    try {
      setIsLoading(true);
      const [permsRes, overridesRes] = await Promise.all([
        apiClient<{ permissions: Permission[] }>("/permissions"),
        apiClient<{ overrides: Override[] }>(
          `/staff/overrides?membership_id=${memberId}`,
        ),
      ]);
      setPermissions(permsRes.permissions || []);
      setOverrides(overridesRes.overrides || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load overrides" });
    } finally {
      setIsLoading(false);
    }
  };

  const permById = useMemo(() => {
    const m = new Map<string, Permission>();
    for (const p of permissions) m.set(p.id, p);
    return m;
  }, [permissions]);

  const overriddenIds = useMemo(
    () => new Set(overrides.map((o) => o.permission_id)),
    [overrides],
  );

  const availablePerms = useMemo(
    () => permissions.filter((p) => !overriddenIds.has(p.id)),
    [permissions, overriddenIds],
  );

  const handleAdd = async () => {
    if (!memberId || !newPermId) {
      toast({ variant: "destructive", title: "Pick a permission first" });
      return;
    }
    try {
      setIsSaving(true);
      await apiClient<unknown>("/staff/overrides", {
        method: "POST",
        body: JSON.stringify({
          membership_id: memberId,
          permission_id: newPermId,
          effect: newEffect,
          reason: newReason || null,
        }),
      });
      toast({ title: "Override added" });
      setNewPermId("");
      setNewReason("");
      setNewEffect("allow");
      await fetchData();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to add override",
        description: detail || "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (permissionId: string) => {
    if (!memberId) return;
    try {
      await apiClient<unknown>(
        `/staff/overrides/${permissionId}?membership_id=${memberId}`,
        { method: "DELETE" },
      );
      toast({ title: "Override removed" });
      await fetchData();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to remove override",
        description: detail || "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permission overrides</DialogTitle>
          <DialogDescription>
            Grant or revoke individual permissions for {memberName}. Overrides
            apply on top of the roles assigned to this member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Current overrides ({overrides.length})
                </Label>
                {overrides.length === 0 ? (
                  <div className="mt-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
                    No overrides. This member has exactly what their roles grant.
                  </div>
                ) : (
                  <ScrollArea className="mt-2 max-h-[240px] rounded-md border">
                    <div className="divide-y">
                      {overrides.map((o) => {
                        const p = permById.get(o.permission_id);
                        return (
                          <div
                            key={o.id}
                            className="flex items-start gap-3 p-3"
                          >
                            <Badge
                              variant={o.effect === "allow" ? "default" : "destructive"}
                              className="mt-0.5"
                            >
                              {o.effect === "allow" ? (
                                <ShieldCheck className="w-3 h-3 mr-1" />
                              ) : (
                                <ShieldX className="w-3 h-3 mr-1" />
                              )}
                              {o.effect}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs">
                                {p?.code || o.permission_id}
                              </div>
                              {p?.description && (
                                <div className="text-xs text-muted-foreground">
                                  {p.description}
                                </div>
                              )}
                              {o.reason && (
                                <div className="text-xs text-muted-foreground mt-1 italic">
                                  Reason: {o.reason}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(o.permission_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Add override
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                  <Select value={newPermId} onValueChange={setNewPermId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a permission" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePerms.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          All permissions already have overrides
                        </div>
                      )}
                      {availablePerms.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs">{p.code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newEffect}
                    onValueChange={(v) => setNewEffect(v as "allow" | "deny")}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow</SelectItem>
                      <SelectItem value="deny">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Reason (optional) — e.g. temporary access for Q2 audit"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={handleAdd} disabled={!newPermId || isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add override
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
