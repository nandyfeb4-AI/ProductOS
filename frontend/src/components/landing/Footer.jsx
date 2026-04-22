import Logo from "@/components/landing/Logo";

const cols = [
  {
    heading: "Product",
    items: ["Overview", "Workflows", "Agents", "Connectors", "Changelog"],
  },
  {
    heading: "Company",
    items: ["About", "Customers", "Careers", "Security"],
  },
  {
    heading: "Resources",
    items: ["Docs", "API", "Guides", "Status"],
  },
];

export default function Footer() {
  return (
    <footer
      data-testid="footer"
      className="bg-white border-t border-black/[0.06] pt-16 pb-10"
    >
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" tone="dark" />
              <span className="font-display text-[17px] font-semibold tracking-display text-[#0A0E1A]">
                ProductOS
              </span>
            </div>
            <p className="mt-4 text-[13.5px] text-[#5A6478] max-w-[320px]">
              The execution layer for product teams. Discovery to delivery —
              one workflow.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.heading}>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8B93A7]">
                {c.heading}
              </div>
              <ul className="mt-4 space-y-2.5">
                {c.items.map((i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="text-[13.5px] text-[#2A3142] hover:text-[#4F7FFF] transition-colors"
                    >
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-black/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-[11.5px] text-[#8B93A7]">
            © {new Date().getFullYear()} ProductOS Labs · Built for product teams
          </div>
          <div className="flex items-center gap-5 text-[12.5px] text-[#5A6478]">
            <a href="#" className="hover:text-[#0A0E1A]">Privacy</a>
            <a href="#" className="hover:text-[#0A0E1A]">Terms</a>
            <a href="#" className="hover:text-[#0A0E1A]">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
