import { Navbar } from "@/components/navbar";
import { DevTimeBar } from "@/components/dev-time-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-14">
        {children}
      </main>
      <DevTimeBar />
    </>
  );
}
