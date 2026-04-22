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

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await authClient.signIn.username({ username, password });
      if (error) {
        toast.error("Invalid username or password");
        return;
      }
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-8">
        <h1 className="text-lg font-semibold text-foreground">Login</h1>

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
            autoComplete="current-password"
            required
            className="border-border bg-background placeholder:text-muted-foreground/50"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Login"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline font-medium">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
