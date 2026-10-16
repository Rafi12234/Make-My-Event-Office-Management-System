import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

// Single reusable back-navigation control shared by every page header.
// Pass `to` for a route link, or omit it to fall back to browser history.
function safeInternalPath(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function BackButton({ to, onClick, title = "Back", className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sharedClassName = `flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-md shadow-black/25 transition-all duration-200 hover:bg-[#222222] hover:shadow-lg hover:shadow-black/35 active:scale-[0.94] ${className}`;

  // Calendar Day passes both route state and a returnTo query parameter.
  // The query parameter survives refresh/HMR, which makes this reliable even
  // if React Router location.state is lost before the employee clicks Back.
  const queryReturnTo = safeInternalPath(
    new URLSearchParams(location.search).get("returnTo"),
  );
  const resolvedTo = queryReturnTo || safeInternalPath(to);

  if (!onClick && resolvedTo) {
    return (
      <Link to={resolvedTo} className={sharedClassName} title={title}>
        <ArrowLeft size={19} strokeWidth={2.5} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={
        onClick ??
        (() => {
          if (queryReturnTo) {
            navigate(queryReturnTo);
            return;
          }
          navigate(-1);
        })
      }
      className={sharedClassName}
      title={title}
    >
      <ArrowLeft size={19} strokeWidth={2.5} />
    </button>
  );
}
