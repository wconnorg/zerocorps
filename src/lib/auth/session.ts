import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * The one place server code asks "who is this?". Protected pages call it themselves,
 * close to the data: a layout is not re-rendered on every navigation, so a check that
 * lives only in a layout can be skipped.
 *
 * It answers in three ways on purpose. If the database cannot be reached we do not know
 * whether the visitor is signed in, and the honest thing to show is "temporarily
 * unavailable", not a sign-in page that will fail too.
 */
export type SessionState =
  | {
      status: "signed-in";
      /** `username` is null until the member has been through `/onboarding`. */
      user: { id: string; email: string; displayName: string; username: string | null };
    }
  | { status: "signed-out" }
  | { status: "unavailable" };

export async function getSessionState(): Promise<SessionState> {
  // Outside the try on purpose. During a build, `headers()` throws Next's own signal that
  // this page must be rendered per request. Catching it would hide that signal.
  const requestHeaders = await headers();
  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) return { status: "signed-out" };
    return {
      status: "signed-in",
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.name ?? "",
        username: session.user.username ?? null,
      },
    };
  } catch (error) {
    console.error(
      `[auth] the session could not be read: ${error instanceof Error ? error.name : "error"}`,
    );
    return { status: "unavailable" };
  }
}
