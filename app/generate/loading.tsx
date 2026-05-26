export default function GenerateLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-32 animate-pulse rounded-xl bg-gray-200" />
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-12 animate-pulse rounded-xl bg-gray-200" />
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mb-6 h-12 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-12 animate-pulse rounded-xl bg-purple-200" />
        </div>
      </div>
    </div>
  );
}
