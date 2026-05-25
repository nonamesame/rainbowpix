export default function ProfileLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6">
        {/* Profile header skeleton */}
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="size-20 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 text-center sm:text-left">
            <div className="mx-auto mb-2 h-6 w-32 animate-pulse rounded bg-gray-200 sm:mx-0" />
            <div className="mx-auto mb-4 h-4 w-48 animate-pulse rounded bg-gray-200 sm:mx-0" />
            <div className="flex justify-center gap-6 sm:justify-start">
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="mb-6 flex gap-2 rounded-xl bg-gray-100 p-1">
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-200" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-2 shadow-sm md:rounded-2xl md:p-3">
              <div className="aspect-square animate-pulse rounded-lg bg-gray-200 md:rounded-xl" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="mt-1.5 h-4 w-12 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
