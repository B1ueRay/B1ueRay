import { redirect } from "next/navigation";
import { adultActor, AppError } from "@/lib/security";
import { MemberNav } from "@/components/shell";
import { AdminNav } from "@/components/admin-nav";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role;
  try {
    role = (await adultActor(["ADMIN", "CREATOR_MANAGER", "MODERATOR"])).role;
  } catch (e) {
    if (e instanceof AppError)
      redirect(e.status === 401 ? "/login" : "/app/feed");
    throw e;
  }
  return (
    <div className="app-layout">
      <MemberNav role={role} />
      <main className="member-main">
        <div className="member-heading">
          <div>
            <div className="eyebrow">VELORA · CREATOR STUDIO</div>
            <h1>Extraordinary, by design.</h1>
            <p className="page-intro">
              Manage your creators. Protect your community. Build with care.
            </p>
          </div>
          <span className="pill">{role.replaceAll("_", " ")}</span>
        </div>
        <AdminNav role={role} />
        {children}
      </main>
    </div>
  );
}
