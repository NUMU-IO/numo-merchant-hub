import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

interface CheckResponse {
  email: string;
  existing_user: boolean;
  tenant_name: string | null;
  tenant_subdomain: string | null;
  expires_at: string;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const token = searchParams.get("token") ?? "";
  const tenantParam = searchParams.get("tenant");

  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [invite, setInvite] = useState<CheckResponse | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setCheckError("This invitation link is missing its token.");
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/staff/invitations/check?token=${encodeURIComponent(token)}`,
          { credentials: "include" },
        );
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setCheckError(
            body?.detail ?? body?.error?.message ?? "This invitation is no longer valid.",
          );
        } else {
          setInvite(body as CheckResponse);
        }
      } catch {
        if (!cancelled) setCheckError("Couldn't reach the server. Try again.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isExistingUser = invite?.existing_user ?? false;

  const handleAccept = async () => {
    if (!token || !invite) return;

    if (!password) {
      setSubmitError("Password is required.");
      return;
    }
    if (!isExistingUser) {
      if (!firstName.trim() || !lastName.trim()) {
        setSubmitError("Please fill in your name.");
        return;
      }
      if (password.length < 6) {
        setSubmitError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setSubmitError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/staff/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password,
          first_name: isExistingUser ? undefined : firstName.trim(),
          last_name: isExistingUser ? undefined : lastName.trim(),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.detail ?? body?.error?.message ?? "Failed to accept invitation.",
        );
      }

      setAccepted(true);
      await refreshUser();
      setTimeout(() => navigate("/", { replace: true }), 800);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <CenteredCard>
        <CardContent className="pt-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Checking invitation…</p>
        </CardContent>
      </CenteredCard>
    );
  }

  if (checkError || !invite) {
    return (
      <CenteredCard>
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>{checkError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </CardContent>
      </CenteredCard>
    );
  }

  if (accepted) {
    return (
      <CenteredCard>
        <CardContent className="pt-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-600" />
          <h2 className="mt-3 text-lg font-semibold">Welcome aboard</h2>
          <p className="text-sm text-muted-foreground">Taking you to the dashboard…</p>
        </CardContent>
      </CenteredCard>
    );
  }

  const tenantLabel = invite.tenant_name || tenantParam || "the team";

  return (
    <CenteredCard>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Join {tenantLabel}</CardTitle>
        <CardDescription>
          {isExistingUser
            ? `Sign in as ${invite.email} to join.`
            : `Create an account for ${invite.email} to join.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {submitError}
          </div>
        )}

        <div className="space-y-4">
          {!isExistingUser && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">
              {isExistingUser ? "Password" : "Create a password"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isExistingUser ? "Your account password" : "At least 6 characters"}
              autoComplete={isExistingUser ? "current-password" : "new-password"}
            />
          </div>

          {!isExistingUser && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            </div>
          )}

          <Button
            onClick={handleAccept}
            disabled={submitting}
            className="w-full"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isExistingUser ? "Sign in & join" : "Create account & join"}
          </Button>
        </div>
      </CardContent>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}
