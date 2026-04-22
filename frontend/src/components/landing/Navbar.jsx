import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/landing/Logo";

const links = [
  { label: "Product", href: "#watch" },
  { label: "How it works", href: "#how" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Connectors", href: "#connectors" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0A0E1A]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#" data-testid="nav-logo" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-display text-[17px] font-semibold text-white tracking-display">
            ProductOS
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
              className="text-[13.5px] text-white/60 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#login"
            data-testid="nav-login"
            className="hidden sm:inline-flex text-[13.5px] text-white/70 hover:text-white transition-colors px-3 py-2"
          >
            Log in
          </a>
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href="#get-started"
            data-testid="nav-cta"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium bg-white text-[#0A0E1A] px-3.5 py-2 rounded-full hover:bg-white/90 transition-colors"
          >
            Get started
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.a>
        </div>
      </div>
    </header>
  );
}
