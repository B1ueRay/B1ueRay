import { AuthForm } from "@/components/auth-form";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <main className="auth-page">
      <AuthForm mode="reset" token={(await searchParams).token} />
    </main>
  );
}
