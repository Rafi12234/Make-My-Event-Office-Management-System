import { useNavigate } from "react-router";
import { HandCoins } from "lucide-react";
import AccountsFormShell from "../components/AccountsFormShell";
import MoneyReceivedForm from "../components/MoneyReceivedForm";

// Standalone page for logging money received. On success it returns to the
// wallet, which refetches the summary on mount, and passes a toast message
// through router state so the confirmation still shows.
export default function MoneyInPage() {
  const navigate = useNavigate();

  return (
    <AccountsFormShell
      eyebrow="Money In"
      title="Log Money Received"
      description="Add cash your boss gave you into your wallet."
      icon={HandCoins}
    >
      <MoneyReceivedForm
        onAdded={() => navigate("/accounts", { state: { toast: "Money added to your wallet." } })}
        onCancel={() => navigate("/accounts")}
      />
    </AccountsFormShell>
  );
}
