import ListingsNav from "@/components/ListingsNav";

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <ListingsNav />
      {children}
    </div>
  );
}
