import { AuthPanel } from '@/components/AuthPanel';

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4">
      <AuthPanel />
    </main>
  );
}
