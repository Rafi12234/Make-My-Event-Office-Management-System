import { useNavigate } from "react-router";
import { ReceiptText } from "lucide-react";
import AccountsFormShell from "../components/AccountsFormShell";
import ExpenseForm from "../components/ExpenseForm";

// Standalone page for logging a cost. On success it returns to the wallet,
// which refetches the summary on mount, and passes a toast message through
// router state so the confirmation still shows.
export default function LogCostPage() {
  const navigate = useNavigate();

  return (
    <AccountsFormShell
      eyebrow="Log a Cost"
      title="Log a New Cost"
      description="Record what you spent, item by item — event based or regular."
      icon={ReceiptText}
      maxWidthClassName="max-w-[1600px]"
    >
      <ExpenseForm
        onSubmitted={() => navigate("/accounts", { state: { toast: "Cost submitted and locked." } })}
        onCancel={() => navigate("/accounts")}
      />
    </AccountsFormShell>
  );
}
