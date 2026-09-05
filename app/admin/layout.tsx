/**
 * The shop's own colours, carried into the back office.
 *
 * The public site is beige and navy, so the dashboard is too — the ground is
 * the same warm beige, cards sit on it in white, and what was black is now the
 * brand navy. The one thing deliberately left alone is the traffic-light
 * colours: red for late, amber for due, green for done. Those have to read as
 * warnings and not as decoration, so they stay outside the palette.
 *
 * Sideways scrolling is stopped here rather than page by page. One element
 * wider than the phone drags the whole document with it, and every section
 * below then looks broken too — so anything that genuinely needs the width
 * scrolls inside its own box instead.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f3ed] text-[#26364d]">{children}</div>
  );
}
