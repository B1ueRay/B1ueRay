"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0c0d10",
          color: "#f1f0eb",
          fontFamily: "Arial,sans-serif",
          padding: "15vh 8%",
          margin: 0,
        }}
      >
        <p style={{ color: "#d4ba8c", letterSpacing: 4 }}>VELORA</p>
        <h1 style={{ fontWeight: 400, fontSize: 40 }}>
          A brief pause in your world.
        </h1>
        <p style={{ color: "#929398", lineHeight: 1.8 }}>
          We’re unable to connect right now. Please try again in a moment.
        </p>
        <button
          style={{
            background: "#d4ba8c",
            border: 0,
            padding: "14px 25px",
            borderRadius: 8,
            marginTop: 20,
            cursor: "pointer",
          }}
          onClick={reset}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
