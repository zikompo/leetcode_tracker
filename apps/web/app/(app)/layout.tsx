import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@leettrack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@leettrack/ui/components/dropdown-menu";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";
import { getViewer } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const avatar = viewer.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={viewer.avatarUrl} alt="" className="size-6 rounded-full" />
  ) : (
    <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-medium">
      {viewer.name.slice(0, 1).toUpperCase()}
    </span>
  );
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 font-semibold text-foreground no-underline hover:no-underline"
          >
            <Logo />
            <span className="hidden sm:inline">LeetTrack</span>
          </Link>
          <Nav />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0 gap-2 px-1.5">
                {avatar}
                <span className="hidden max-w-32 truncate md:inline">{viewer.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="truncate">{viewer.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              {!viewer.demo && (
                <form action={signOut}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut /> Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {viewer.demo && (
        <div
          className="border-b border-primary/20 bg-primary/10 px-4 py-1.5 text-center text-xs text-link"
          role="status"
        >
          Demo mode: sample data, and nothing you change is saved.
        </div>
      )}
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-10">{children}</main>
      <footer className="mx-auto flex max-w-6xl justify-end px-4 pb-8 text-xs text-muted-foreground">
        <Link href="/privacy">Privacy policy</Link>
      </footer>
    </>
  );
}
