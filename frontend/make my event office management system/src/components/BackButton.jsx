import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

// Single reusable back-navigation control shared by every page header.
// Pass `to` for a route link, or omit it to fall back to browser history.
export default function BackButton({ to, onClick, title = "Back", className = "" }) {
  const navigate = useNavigate();
  const sharedClassName = `flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-md shadow-black/25 transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/35 active:scale-[0.94] ${className}`;

  if (to) {
    return (
      <Link to={to} className={sharedClassName} title={title}>
        <ArrowLeft size={19} strokeWidth={2.5} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(-1))}
      className={sharedClassName}
      title={title}
    >
      <ArrowLeft size={19} strokeWidth={2.5} />
    </button>
  );
}
