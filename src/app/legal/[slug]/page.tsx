import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Footer } from "@/components/shell";
export default async function Legal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const d = await db.legalDocument.findFirst({
    where: { slug: (await params).slug, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!d) notFound();
  return (
    <>
      <main className="legal-page page-container">
        <div className="eyebrow">IMAGINATION, WITH INTEGRITY</div>
        <h1>{d.title}</h1>
        <p className="fine-print">
          Version {d.version} · Development MVP · Not legal advice
        </p>
        <article>
          {d.body.split(". ").map((p, i) => (
            <p key={i}>
              {p}
              {p.endsWith(".") ? "" : "."}
            </p>
          ))}
        </article>
      </main>
      <Footer />
    </>
  );
}
