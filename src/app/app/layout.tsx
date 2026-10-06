import { redirect } from "next/navigation";
import { adultActor, AppError } from "@/lib/security";
import { MemberNav } from "@/components/shell";
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role;
  try {
    role = (await adultActor()).role;
  } catch (e) {
    if (e instanceof AppError) redirect(e.status === 401 ? "/login" : "/");
    throw e;
  }
  return (
    <div className="app-layout">
      <MemberNav role={role} />
      <main className="member-main">{children}</main>
    </div>
  );
}
