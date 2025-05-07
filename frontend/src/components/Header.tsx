"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    getUser();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
  };

  // Only show header on protected routes
  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="w-full border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/dashboard" className="font-bold text-xl text-planit">
              Planit
            </Link>
          </div>

          <nav className="flex items-center space-x-6">
            <div className="hidden md:flex space-x-6">
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Home
              </NavLink>
              <NavLink
                href="/dashboard/upload"
                active={pathname === "/dashboard/upload"}
              >
                Upload
              </NavLink>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                <span className="hidden md:inline text-sm text-muted-foreground">
                  {user.email}
                </span>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Sign out</span>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

type NavLinkProps = {
  href: string;
  active: boolean;
  children: React.ReactNode;
};

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-primary ${
        active
          ? "text-primary border-b-2 border-planit"
          : "text-muted-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
