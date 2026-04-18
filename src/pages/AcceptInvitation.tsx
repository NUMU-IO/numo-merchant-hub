import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

interface AcceptInvitationData {
  status: string;
  user_id: string;
  membership_id: string;
  tenant_id: string;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const tenant = searchParams.get("tenant");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(true);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
    }
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    if (isNewUser) {
      if (!firstName || !lastName || !password) {
        setError("Please fill in all fields");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/staff/invitations/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token,
            first_name: isNewUser ? firstName : undefined,
            last_name: isNewUser ? lastName : undefined,
            password: isNewUser ? password : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || "Failed to accept invitation");
      }

      const data: AcceptInvitationData = await response.json();
      setIsAccepted(true);

      // Store tokens and redirect
      localStorage.setItem("access_token", data.user_id);
      localStorage.setItem("membership_id", data.membership_id);
      localStorage.setItem("tenant_id", data.tenant_id);

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(message || "Failed to accept invitation");
    } finally {
      setIsLoading(false);
    }
  }

  if (isAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-gray-600">Setting up your account...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join {tenant || "the team"}</CardTitle>
          <CardDescription>
            You've been invited to join as a staff member
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="existingUser"
                checked={!isNewUser}
                onChange={(e) => setIsNewUser(!e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="existingUser" className="text-sm font-normal">
                I already have an account
              </Label>
            </div>

            {isNewUser && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
              </>
            )}

            <Button 
              onClick={handleAccept} 
              disabled={isLoading || !token}
              className="w-full"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isNewUser ? "Create account & join" : "Sign in & join"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}