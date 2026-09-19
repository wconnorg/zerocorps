import { site } from "@/config/site";
import { Wordmark } from "./wordmark";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="text-xs text-subtle">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
        <p className="max-w-md text-xs/5 text-subtle">{site.disclaimer}</p>
      </div>
    </footer>
  );
}
