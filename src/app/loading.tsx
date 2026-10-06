export default function Loading() {
  return (
    <main className="page-container">
      <div className="skeleton skeleton-title" />
      <div className="creator-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton skeleton-card" key={n} />
        ))}
      </div>
    </main>
  );
}
