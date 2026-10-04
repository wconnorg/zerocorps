import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      {/* A column, so the landing page's panels can fill the height between the two. */}
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </>
  );
}
