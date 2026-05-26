export default function GenerateLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-6 items-start">
          {/* Form skeleton */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
              <div className="flex gap-3">
                <div className="size-16 animate-pulse rounded-xl bg-gray-200" />
                <div className="flex-1">
                  <div className="h-24 animate-pulse rounded-xl bg-gray-100 md:h-28" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex gap-1">
                  <div className="h-7 w-10 animate-pulse rounded-lg bg-gray-200" />
                  <div className="h-7 w-10 animate-pulse rounded-lg bg-gray-200" />
                  <div className="h-7 w-10 animate-pulse rounded-lg bg-gray-200" />
                </div>
                <div className="flex-1" />
                <div className="h-8 w-16 animate-pulse rounded-lg bg-violet-200" />
              </div>
            </div>
            {/* Examples skeleton */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white p-1.5 shadow-sm">
                  <div className="aspect-square animate-pulse rounded-lg bg-gray-200" />
                  <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Result skeleton */}
          <div className="sticky top-6">
            <div className="rounded-2xl bg-white p-3 shadow-sm md:p-4">
              <div className="aspect-square animate-pulse rounded-xl bg-gray-100" />
              <div className="mt-3 flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-200" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-200" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
