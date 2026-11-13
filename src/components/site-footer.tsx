import Link from "next/link";

const links = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refunds", "/refund-policy"],
  ["Contact", "/contact"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getUTCFullYear()} Locked In</span>
      <nav aria-label="Legal and support">
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </footer>
  );
}
