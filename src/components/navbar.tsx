"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navbar() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  const displayName = (session?.user as { username?: string })?.username ?? session?.user?.name ?? "?";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">LeetReps</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button aria-label="User menu" variant="ghost" className="relative h-8 w-8 rounded-full border-0 outline-none" />
            }
          >
            <Avatar className="h-8 w-8 after:hidden">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {displayName}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer flex items-center justify-between gap-2">
              Sign out
              <LogOut className="h-3.5 w-3.5" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
