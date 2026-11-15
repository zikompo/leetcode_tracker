import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { signOut } from "@/lib/actions";
import { getViewer } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="brand">
            LeetTrack
          </Link>
          <Nav />
          <div className="who">
            {viewer.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.avatarUrl} alt="" />
            )}
            <span>{viewer.name}</span>
            {!viewer.demo && (
              <form action={signOut}>
                <button className="btn" type="submit">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      {viewer.demo && (
        <div className="banner" role="status">
          Demo mode: sample data, and nothing you change is saved.
        </div>
      )}
      <main className="page">{children}</main>
    </>
  );
}
