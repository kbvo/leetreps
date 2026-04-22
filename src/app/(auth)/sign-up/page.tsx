"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

function validatePassword(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) return rule.label + " is required";
  }
  return null;
}

export default function SignUpPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (password.toLowerCase() === username.toLowerCase()) {
      toast.error("Password cannot match your username");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        name: username,
        email: `${username}@local.leetreps`,
        password,
        username,
      });
      if (error) {
        toast.error(
          error.message?.toLowerCase().includes("unique") ||
          error.message?.toLowerCase().includes("already")
            ? "Username is already taken"
            : (error.message ?? "Sign up failed")
        );
        return;
      }
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const passwordFailed = PASSWORD_RULES.filter((r) => password && !r.test(password));

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-8">
        <h1 className="text-lg font-semibold text-foreground">Create Account</h1>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="border-border bg-background placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="border-border bg-background placeholder:text-muted-foreground/50"
          />
          {passwordFailed.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs text-destructive">
              {passwordFailed.map((r) => (
                <li key={r.label}>• {r.label}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="border-border bg-background placeholder:text-muted-foreground/50"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive">• Passwords do not match</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Account"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
