import type { ReactNode } from "react";

/**
 * Minimal layout for the /checkin deep-link page.
 * No sidebar, no role nav — just the content.
 */
export default function CheckinLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
