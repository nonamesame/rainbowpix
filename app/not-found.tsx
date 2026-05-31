export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-gray-200">404</h1>
        <p className="mb-4 text-lg text-gray-900">页面未找到</p>
        <a
          href="/"
          className="inline-block rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
