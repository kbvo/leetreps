export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          LeetReps
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
