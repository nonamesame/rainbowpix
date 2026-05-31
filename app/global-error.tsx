"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>出错了</h2>
          <p>{error.message}</p>
          <button onClick={() => reset()}>重试</button>
        </div>
      </body>
    </html>
  );
}
