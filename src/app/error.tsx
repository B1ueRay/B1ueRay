"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-container">
      <div className="empty-state">
        <h1>A brief pause.</h1>
        <p>We couldn’t load this part of your world. Please try again.</p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
