export default function GalleryLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6">
        <div className="mb-6 flex items-baseline gap-2">
          <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-10 animate-pulse rounded bg-gray-200" />
        </div>
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
