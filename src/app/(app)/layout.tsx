import { AppShell } from "@/components/app/app-shell";

/**
 * The signed-in area. The frame (header, profile menu) is `AppShell`, shared with the
 * Academy's pages. Each page checks the session for itself.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
