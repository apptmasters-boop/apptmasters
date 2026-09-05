import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-blue-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/dashboard"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
