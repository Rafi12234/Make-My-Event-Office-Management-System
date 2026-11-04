import {
  prisma,
  formatDateOnly,
  formatDateTime,
  roundMoney,
} from "../utils/accountsShared.js";

const BILL_INCLUDE = {
  approvedByAdmin: {
    select: {
      fullName: true,
    },
  },
  voidedByAdmin: {
    select: {
      fullName: true,
    },
  },
  items: {
    include: {
      vendor: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
};

function hasMeaningfulTimestampChange(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

function correctionInfo(expense) {
  // Approval/void changes the parent expense.updatedAt too, so using the
  // parent timestamp would incorrectly mark every approved bill as corrected.
  // Admin bill correction updates the item rows themselves; approval does not.
  // Item timestamps therefore give us a reliable no-schema-change signal.
  const correctedItems = (expense.items || []).filter((item) =>
    hasMeaningfulTimestampChange(item.createdAt, item.updatedAt),
  );

  if (!correctedItems.length) {
    return { wasCorrected: false, correctedAt: null };
  }

  const correctedAtValue = correctedItems.reduce((latest, item) => {
    const time = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    return time > latest ? time : latest;
  }, 0);

  return {
    wasCorrected: true,
    correctedAt: correctedAtValue
      ? formatDateTime(new Date(correctedAtValue))
      : null,
  };
}

function serializeSubmittedBill(expense) {
  const { wasCorrected, correctedAt } = correctionInfo(expense);
  const totalAmount = Number(expense.totalAmount);
  const walletDeductionAmount = Number(expense.walletDeductionAmount);

  let reviewStatus = "pending";
  if (expense.status === "void") reviewStatus = "rejected";
  else if (expense.approved) reviewStatus = "approved";

  return {
    id: String(expense.id),
    costType: expense.costType,
    linkedRowKey: expense.linkedRowKey || null,
    eventClientName: expense.eventClientNameSnapshot || null,
    eventDate: formatDateOnly(expense.eventDateSnapshot),
    totalAmount,
    walletDeductionAmount,
    vendorPayableAmount: roundMoney(totalAmount - walletDeductionAmount),
    paymentSource: expense.paymentSource,

    reviewStatus,
    approved: Boolean(expense.approved),
    approvedByName: expense.approvedByAdmin?.fullName || null,
    approvedAt: expense.approvedAt ? formatDateTime(expense.approvedAt) : null,

    rejectedReason: expense.status === "void" ? expense.voidReason || null : null,
    rejectedByName: expense.status === "void" ? expense.voidedByAdmin?.fullName || null : null,
    rejectedAt: expense.status === "void" && expense.voidedAt
      ? formatDateTime(expense.voidedAt)
      : null,

    wasCorrected,
    correctedAt,
    submittedAt: formatDateTime(expense.createdAt),
    updatedAt: formatDateTime(expense.updatedAt),

    items: (expense.items || []).map((item) => ({
      id: String(item.id),
      purpose: item.purpose,
      costDate: formatDateOnly(item.costDate),
      quantity: Number(item.quantity),
      perQtyAmount: Number(item.perQtyAmount),
      totalAmount: Number(item.totalAmount),
      vendorId: item.vendorId ? String(item.vendorId) : null,
      vendorName: item.vendor?.name || null,
      paymentStatus: item.paymentStatus || null,
      receiptUrl: item.receiptFileUrl || null,
      receiptOriginalFileName: item.receiptOriginalFileName || null,
    })),
  };
}

// GET /api/accounts/submitted-bills
// Returns every bill submitted by the currently authenticated employee,
// including pending, approved and voided/rejected records. No employee id is
// accepted from the client, preventing cross-employee access.
export async function listSubmittedBills(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);

    const expenses = await prisma.accountExpense.findMany({
      where: {
        employeeId,
      },
      include: BILL_INCLUDE,
      orderBy: {
        id: "desc",
      },
    });

    const bills = expenses.map(serializeSubmittedBill);

    res.json({
      data: {
        bills,
        summary: {
          total: bills.length,
          pending: bills.filter((bill) => bill.reviewStatus === "pending").length,
          approved: bills.filter((bill) => bill.reviewStatus === "approved").length,
          rejected: bills.filter((bill) => bill.reviewStatus === "rejected").length,
          corrected: bills.filter((bill) => bill.wasCorrected).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
