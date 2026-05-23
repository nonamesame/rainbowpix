"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">出错了</h1>
        <p className="mb-4 text-sm text-gray-500">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        >
          重试
        </button>
      </div>
    </div>
  );
}
