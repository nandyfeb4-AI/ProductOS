export default function Logo({ className = "h-7 w-7", tone = "light" }) {
  const bg = tone === "light" ? "#4F7FFF" : "#0A0E1A";
  const fg = "#FFFFFF";
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="productos-logo"
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      <path
        d="M9 22V10h6.2c2.5 0 4.3 1.6 4.3 4.1 0 2.5-1.8 4.1-4.3 4.1H12V22H9zm3-6.5h3c1.1 0 1.8-.6 1.8-1.4 0-.9-.7-1.4-1.8-1.4h-3v2.8z"
        fill={fg}
      />
      <circle cx="22.5" cy="20.5" r="2.5" fill="#2DD4BF" />
    </svg>
  );
}
