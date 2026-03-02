import { getCurrentUser } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Productos</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-zinc-500 dark:text-zinc-400">Welcome, {user.name ?? user.email}!</p>
      </main>
    </div>
  );
}
