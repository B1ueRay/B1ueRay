import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validAgeToken } from "@/lib/age";
import { Navbar, AgeGate, PrivacyPreferences } from "@/components/shell";
import { ToastHost } from "@/components/ui";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "VELORA — A world beyond ordinary",
    template: "%s · VELORA",
  },
  description:
    "Discover fictional adult AI virtual creators. Private conversations, exclusive digital artistry, and a world of possibility.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          role: true,
          status: true,
          age: { select: { state: true } },
        },
      })
    : null;
  const required =
    !validAgeToken((await cookies()).get("velora-adult")?.value) ||
    (!!user &&
      (!user.age || !["SELF_DECLARED", "VERIFIED"].includes(user.age.state)));
  return (
    <html lang="en">
      <body>
        <Navbar
          user={
            user?.status === "ACTIVE"
              ? { name: user.name, role: user.role }
              : null
          }
        />
        {children}
        <ToastHost />
        <AgeGate required={required} />
        <PrivacyPreferences />
      </body>
    </html>
  );
}
