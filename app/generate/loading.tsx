export default function GenerateLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50/50 px-4">
      <div className="w-full max-w-3xl">
        <div className="h-[30vh]" />
        {/* Title skeleton */}
        <div className="mb-8 flex justify-center">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-gray-200" />
        </div>

        {/* Input card skeleton */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="size-20 animate-pulse rounded-xl border-2 border-dashed border-gray-200 bg-gray-50" />
            </div>
            <div className="flex-1">
              <div className="h-32 animate-pulse rounded-xl bg-gray-100 md:h-36" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <div className="h-8 w-32 animate-pulse rounded-full bg-violet-100" />
            <div className="flex gap-1">
              <div className="h-7 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="h-7 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="h-7 w-10 animate-pulse rounded-full bg-gray-200" />
            </div>
            <div className="flex-1" />
            <div className="h-8 w-16 animate-pulse rounded-full bg-violet-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
