import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  UserCog, Plus, Search, MoreHorizontal, Shield, Mail, Calendar, 
  RefreshCw, X, Loader2, Trash2, Edit, Key
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/services/api";
import { useDashboardStore } from "@/contexts/StoreContext";
import { MemberOverridesDialog } from "@/components/staff/MemberOverridesDialog";

interface StaffMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  is_owner: boolean;
  joined_at: string | null;
  roles?: Role[];
}

interface Role {
  id: string;
  name: string;
  slug: string;
}

interface Invitation {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
}

interface PendingAccessRequest {
  id: string;
  requester_user_id: string;
  requested_role_ids: string[];
  justification: string;
  created_at: string;
}

export default function StaffPage() {
  const { toast } = useToast();
  const { currentStore } = useDashboardStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [accessRequests, setAccessRequests] = useState<PendingAccessRequest[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isSeedingRoles, setIsSeedingRoles] = useState(false);

  // Edit roles dialog
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  // Delete confirm
  const [deletingMember, setDeletingMember] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permission overrides
  const [overridesMember, setOverridesMember] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    fetchData();
  }, [currentStore?.id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [staffRes, invitesRes, rolesRes] = await Promise.all([
        apiClient<{ staff: StaffMember[] }>("/staff"),
        apiClient<{ invitations: Invitation[] }>("/staff/invitations"),
        apiClient<{ roles: Role[] }>("/roles"),
      ]);
      setStaff(staffRes.staff || []);
      setInvitations(invitesRes.invitations || []);
      setRoles(rolesRes.roles || []);
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load staff data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast({ variant: "destructive", title: "Email is required" });
      return;
    }

    try {
      setIsInviting(true);
      const result = await apiClient<{
        invitation_id: string;
        url: string;
        email_sent: boolean;
      }>("/staff/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role_ids: selectedRoles,
          message: inviteMessage,
        }),
      });

      if (result.email_sent) {
        toast({
          title: "Invitation sent",
          description: `Invitation email sent to ${inviteEmail}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invitation created but email failed",
          description: `Invitation for ${inviteEmail} was created but the email could not be sent. Share the invite link manually.`,
        });
      }

      setShowInviteDialog(false);
      setInviteEmail("");
      setSelectedRoles([]);
      setInviteMessage("");
      fetchData();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to send invitation",
        description: detail || "Unknown error",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await apiClient<unknown>(`/staff/invitations/${invitationId}`, {
        method: "DELETE",
      });
      toast({ title: "Invitation revoked" });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to revoke invitation" });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await apiClient<unknown>(
        `/staff/access-requests/${requestId}/approve`,
        { method: "POST", body: "{}" },
      );
      toast({ title: "Access request approved" });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to approve request" });
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await apiClient<unknown>(
        `/staff/access-requests/${requestId}/deny`,
        { method: "POST", body: "{}" },
      );
      toast({ title: "Access request denied" });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to deny request" });
    }
  };

  const handleSeedRoles = async () => {
    try {
      setIsSeedingRoles(true);
      const res = await apiClient<{ roles: Role[] }>("/roles/seed-defaults", {
        method: "POST",
        body: "{}",
      });
      setRoles(res.roles || []);
      toast({ title: "Default roles created" });
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to create default roles",
        description: detail || "Unknown error",
      });
    } finally {
      setIsSeedingRoles(false);
    }
  };

  const openEditRoles = (member: StaffMember) => {
    setEditingMember(member);
    setEditRoleIds((member.roles || []).map((r) => r.id));
  };

  const handleSaveRoles = async () => {
    if (!editingMember) return;
    try {
      setIsSavingRoles(true);
      await apiClient<unknown>(`/staff/${editingMember.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ role_ids: editRoleIds }),
      });
      toast({ title: "Roles updated" });
      setEditingMember(null);
      fetchData();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to update roles",
        description: detail || "Unknown error",
      });
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingMember) return;
    try {
      setIsDeleting(true);
      await apiClient<unknown>(`/staff/${deletingMember.id}`, {
        method: "DELETE",
      });
      toast({ title: "Staff member removed" });
      setDeletingMember(null);
      fetchData();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Failed to remove staff",
        description: detail || "Unknown error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
           member.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            Staff Management
          </h1>
          <p className="text-muted-foreground">Manage your team members and their permissions</p>
        </div>
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Invite Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Assign Roles (optional)</Label>
                {roles.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
                    <span>No roles exist yet for this store.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSeedRoles}
                      disabled={isSeedingRoles}
                    >
                      {isSeedingRoles && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                      Create defaults
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <Badge
                        key={role.id}
                        variant={selectedRoles.includes(role.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedRoles(
                            selectedRoles.includes(role.id)
                              ? selectedRoles.filter((id) => id !== role.id)
                              : [...selectedRoles, role.id]
                          );
                        }}
                      >
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message (optional)</Label>
                <Input
                  id="message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Welcome message..."
                />
              </div>
              <Button onClick={handleInvite} disabled={isInviting} className="w-full">
                {isInviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
            <CardDescription>Invitations awaiting acceptance</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{formatDate(invite.created_at)}</TableCell>
                    <TableCell>{formatDate(invite.expires_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvitation(invite.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>{staff.length} members</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(member.first_name, member.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.first_name} {member.last_name}
                          {member.is_owner && (
                            <Badge variant="secondary" className="ml-2">Owner</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === "active" ? "default" : "secondary"}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {member.roles?.map((role) => (
                        <Badge key={role.id} variant="outline" className="text-xs">
                          {role.name}
                        </Badge>
                      ))}
                      {!member.roles?.length && (
                        <span className="text-muted-foreground text-sm">
                          {member.is_owner ? "All access" : "No roles"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(member.joined_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRoles(member)}
                        disabled={member.is_owner}
                        title={member.is_owner ? "Owner roles cannot be edited" : "Edit roles"}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOverridesMember(member)}
                        disabled={member.is_owner}
                        title={member.is_owner ? "Owner has all permissions" : "Permission overrides"}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      {!member.is_owner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingMember(member)}
                          title="Remove staff member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Roles Dialog */}
      <Dialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Roles</DialogTitle>
            <DialogDescription>
              {editingMember
                ? `Update roles for ${editingMember.first_name} ${editingMember.last_name}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {roles.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
                <span>No roles exist yet for this store.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSeedRoles}
                  disabled={isSeedingRoles}
                >
                  {isSeedingRoles && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                  Create defaults
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge
                    key={role.id}
                    variant={editRoleIds.includes(role.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      setEditRoleIds(
                        editRoleIds.includes(role.id)
                          ? editRoleIds.filter((id) => id !== role.id)
                          : [...editRoleIds, role.id],
                      )
                    }
                  >
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingMember(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRoles} disabled={isSavingRoles}>
                {isSavingRoles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Overrides Dialog */}
      <MemberOverridesDialog
        open={!!overridesMember}
        onClose={() => setOverridesMember(null)}
        memberId={overridesMember?.id || null}
        memberName={
          overridesMember
            ? `${overridesMember.first_name} ${overridesMember.last_name}`
            : ""
        }
      />

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deletingMember}
        onOpenChange={(open) => !open && setDeletingMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove staff member?</DialogTitle>
            <DialogDescription>
              {deletingMember
                ? `${deletingMember.first_name} ${deletingMember.last_name} (${deletingMember.email}) will lose access to this store.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingMember(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStaff}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}