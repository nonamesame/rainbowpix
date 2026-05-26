export default function HomeLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-6 py-6 md:px-12 lg:px-20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 md:gap-4">
          {[
            "aspect-[3/4]",
            "aspect-square",
            "aspect-[4/5]",
            "aspect-[3/4]",
            "aspect-square",
            "aspect-[4/5]",
            "aspect-[3/4]",
            "aspect-square",
          ].map((aspect, i) => (
            <div key={i} className="mb-3 break-inside-avoid md:mb-4">
              <div className={`${aspect} animate-pulse rounded-lg bg-gray-200 md:rounded-xl`} />
              <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
                <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
