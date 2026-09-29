/**
 * The Academy's pages. No frame of its own: `/academy` shows the public site's frame to a
 * visitor and the signed-in frame (`AppShell`) to a member, so each page picks its own.
 * Every page checks the session for itself.
 */
export default function AcademyLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
