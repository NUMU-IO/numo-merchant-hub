import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, Loader2, Trash2, Copy, Edit2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/services/api";
import { useDashboardStore } from "@/contexts/StoreContext";

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  is_locked: boolean;
  is_owner: boolean;
  version: number;
}

interface Permission {
  id: string;
  code: string;
  domain: string;
  action: string;
  qualifier?: string | null;
  description?: string | null;
  risk_level: string;
}

interface RoleDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  permissions: { permission_id: string; scope_qualifier: Record<string, unknown> }[];
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const riskColor = (level: string) => {
  switch (level) {
    case "CRITICAL":
      return "destructive" as const;
    case "HIGH":
      return "destructive" as const;
    case "MEDIUM":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

export default function RolesPage() {
  const { toast } = useToast();
  const { currentStore } = useDashboardStore();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [cloneFromId, setCloneFromId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  // Permissions editor
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editDraftName, setEditDraftName] = useState("");
  const [editDraftDescription, setEditDraftDescription] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [permsQuery, setPermsQuery] = useState("");
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Delete confirm
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    void fetchAll();
  }, [currentStore?.id]);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        apiClient<{ roles: Role[] }>("/roles"),
        apiClient<{ permissions: Permission[] }>("/permissions"),
      ]);
      setRoles(rolesRes.roles || []);
      setPermissions(permsRes.permissions || []);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Failed to load roles",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const permsByDomain = useMemo(() => {
    const filtered = permsQuery
      ? permissions.filter(
          (p) =>
            p.code.toLowerCase().includes(permsQuery.toLowerCase()) ||
            (p.description || "").toLowerCase().includes(permsQuery.toLowerCase()),
        )
      : permissions;
    const map = new Map<string, Permission[]>();
    for (const p of filtered) {
      if (!map.has(p.domain)) map.set(p.domain, []);
      map.get(p.domain)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions, permsQuery]);

  const openCreate = () => {
    setNewName("");
    setNewSlug("");
    setNewDescription("");
    setCloneFromId("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) {
      toast({ variant: "destructive", title: "Name and slug are required" });
      return;
    }
    try {
      setIsCreating(true);
      if (cloneFromId) {
        await apiClient<{ id: string }>("/roles/clone", {
          method: "POST",
          body: JSON.stringify({
            source_role_id: cloneFromId,
            new_name: newName,
            new_slug: newSlug,
          }),
        });
      } else {
        await apiClient<{ id: string }>("/roles", {
          method: "POST",
          body: JSON.stringify({
            name: newName,
            slug: newSlug,
            description: newDescription || null,
          }),
        });
      }
      toast({ title: "Role created" });
      setShowCreate(false);
      await fetchAll();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to create role",
        description: detail || "Unknown error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openEdit = async (role: Role) => {
    setEditingRole(role);
    setEditDraftName(role.name);
    setEditDraftDescription(role.description || "");
    setSelectedPermIds(new Set());
    setPermsQuery("");
    try {
      setIsLoadingDetail(true);
      const detail = await apiClient<RoleDetail>(`/roles/${role.id}`);
      setSelectedPermIds(new Set(detail.permissions.map((p) => p.permission_id)));
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load role permissions" });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const togglePerm = (id: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDomain = (domainPerms: Permission[]) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      const allSelected = domainPerms.every((p) => next.has(p.id));
      if (allSelected) domainPerms.forEach((p) => next.delete(p.id));
      else domainPerms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;
    try {
      setIsSavingPerms(true);
      if (
        editDraftName !== editingRole.name ||
        (editDraftDescription || "") !== (editingRole.description || "")
      ) {
        await apiClient<unknown>(`/roles/${editingRole.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editDraftName,
            description: editDraftDescription,
          }),
        });
      }
      await apiClient<unknown>(`/roles/${editingRole.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          permission_ids: Array.from(selectedPermIds),
        }),
      });
      toast({ title: "Role updated" });
      setEditingRole(null);
      await fetchAll();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to save role",
        description: detail || "Unknown error",
      });
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      setIsDeleting(true);
      await apiClient<unknown>(`/roles/${deletingRole.id}`, { method: "DELETE" });
      toast({ title: "Role deleted" });
      setDeletingRole(null);
      await fetchAll();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to delete role",
        description: detail || "Unknown error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const permCountForRole = (_r: Role) => undefined; // shown in editor; avoid N+1 list query here

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Roles &amp; Permissions
          </h1>
          <p className="text-muted-foreground">
            Define roles by picking from {permissions.length} fine-grained permissions
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Roles</CardTitle>
          <CardDescription>
            {roles.length} role{roles.length === 1 ? "" : "s"} in this store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                void permCountForRole(role);
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-xs text-muted-foreground">
                          {role.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {role.slug}
                    </TableCell>
                    <TableCell>
                      {role.is_owner ? (
                        <Badge variant="default">Owner</Badge>
                      ) : role.is_locked ? (
                        <Badge variant="secondary">Locked</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      v{role.version}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(role)}
                          disabled={role.is_locked}
                          title={
                            role.is_locked
                              ? "Locked role cannot be edited"
                              : "Edit permissions"
                          }
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCloneFromId(role.id);
                            setNewName(`${role.name} (copy)`);
                            setNewSlug(`${role.slug}-copy`);
                            setNewDescription("");
                            setShowCreate(true);
                          }}
                          title="Clone role"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {!role.is_locked && !role.is_owner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingRole(role)}
                            title="Delete role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No roles yet. Click &ldquo;Create role&rdquo; to add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Start from scratch or clone an existing role as a starting point.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Clone from (optional)</Label>
              <Select
                value={cloneFromId || "none"}
                onValueChange={(v) => setCloneFromId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start blank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Start blank</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === slugify(newName)) {
                    setNewSlug(slugify(e.target.value));
                  }
                }}
                placeholder="Warehouse lead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-slug">Slug</Label>
              <Input
                id="role-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(slugify(e.target.value))}
                placeholder="warehouse-lead"
              />
            </div>
            {!cloneFromId && (
              <div className="space-y-2">
                <Label htmlFor="role-desc">Description (optional)</Label>
                <Textarea
                  id="role-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this role is for…"
                  rows={3}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Permissions Dialog */}
      <Dialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Edit {editingRole?.name}
            </DialogTitle>
            <DialogDescription>
              Toggle the permissions granted by this role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editDraftName}
                  onChange={(e) => setEditDraftName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Input
                  id="edit-desc"
                  value={editDraftDescription}
                  onChange={(e) => setEditDraftDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Input
                placeholder="Filter permissions…"
                value={permsQuery}
                onChange={(e) => setPermsQuery(e.target.value)}
                className="max-w-xs"
              />
              <div className="text-sm text-muted-foreground">
                {selectedPermIds.size} of {permissions.length} selected
              </div>
            </div>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[380px] rounded-md border p-2">
                <div className="space-y-4">
                  {permsByDomain.map(([domain, perms]) => {
                    const allSelected = perms.every((p) => selectedPermIds.has(p.id));
                    const someSelected = perms.some((p) => selectedPermIds.has(p.id));
                    return (
                      <div key={domain}>
                        <div className="flex items-center justify-between px-1 pb-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={
                                allSelected
                                  ? true
                                  : someSelected
                                    ? ("indeterminate" as const)
                                    : false
                              }
                              onCheckedChange={() => toggleDomain(perms)}
                              id={`dom-${domain}`}
                            />
                            <Label htmlFor={`dom-${domain}`} className="uppercase text-xs tracking-wide text-muted-foreground cursor-pointer">
                              {domain}
                            </Label>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {perms.filter((p) => selectedPermIds.has(p.id)).length}/{perms.length}
                          </span>
                        </div>
                        <div className="space-y-1 pl-6">
                          {perms.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedPermIds.has(p.id)}
                                onCheckedChange={() => togglePerm(p.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs">{p.code}</span>
                                  <Badge variant={riskColor(p.risk_level)} className="text-[10px]">
                                    {p.risk_level.toLowerCase()}
                                  </Badge>
                                </div>
                                {p.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {p.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {permsByDomain.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No permissions match &ldquo;{permsQuery}&rdquo;
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingPerms || isLoadingDetail}>
                {isSavingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
            <DialogDescription>
              {deletingRole
                ? `"${deletingRole.name}" will be removed. Staff members currently assigned to it will lose the permissions it granted.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingRole(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
