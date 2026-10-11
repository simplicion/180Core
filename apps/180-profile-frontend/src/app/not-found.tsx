import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
      <h1 className="text-4xl font-black mb-2">404 - Page Not Found</h1>
      <p className="text-zinc-400 mb-6">The profile page you are looking for does not exist.</p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm transition-colors"
      >
        Back to Profile
      </Link>
    </div>
  );
}
