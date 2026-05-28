"use client";

interface PageWrapperProps {
  children: React.ReactNode;
}

export default function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-4">
      {children}
    </div>
  );
}
