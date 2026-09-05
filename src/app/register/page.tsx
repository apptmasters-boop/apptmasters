import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Registration is closed</h1>
        <p className="text-sm text-gray-500 mb-6">
          New accounts are not available yet. Check back soon!
        </p>
        <Link href="/login"
          className="inline-block w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
