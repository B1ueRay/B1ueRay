import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-container empty-state">
      <div className="eyebrow">404 · A DIFFERENT PATH</div>
      <h1>This moment has moved on.</h1>
      <p>The page may be unavailable or removed.</p>
      <Link className="button" href="/explore">
        Discover something new
      </Link>
    </main>
  );
}
