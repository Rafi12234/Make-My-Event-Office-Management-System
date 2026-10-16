import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ManagementPage from "./pages/ManagementPage";
import ClientMeetingsPage from "./pages/ClientMeetingsPage";
import ClientCallsPage from "./pages/ClientCallsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarDayPage from "./pages/CalendarDayPage";
import AccountsPage from "../../../Accounts/frontend/pages/AccountsPage";
import MoneyInPage from "../../../Accounts/frontend/pages/MoneyInPage";
import LogCostPage from "../../../Accounts/frontend/pages/LogCostPage";
import VendorsPage from "../../../Accounts/frontend/pages/VendorsPage";
import VendorProfilePage from "../../../Accounts/frontend/pages/VendorProfilePage";
import PDFGeneratorPage from "../../../PDFGenerator/frontend/pages/PDFGeneratorPage";
import PDFPreviewPage from "../../../PDFGenerator/frontend/pages/PDFPreviewPage";
import MoneyReceiptGeneratorPage from "../../../MoneyReceiptGenerator/frontend/pages/MoneyReceiptGeneratorPage";
import MoneyReceiptPreviewPage from "../../../MoneyReceiptGenerator/frontend/pages/MoneyReceiptPreviewPage";
import MoneyReceiptHistoryPage from "../../../MoneyReceiptGenerator/frontend/pages/MoneyReceiptHistoryPage";
import AdminPage from "./pages/admin/AdminPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminClientDetailPage from "./pages/admin/AdminClientDetailPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import AdminEmployeeDetailPage from "./pages/admin/AdminEmployeeDetailPage";
import AdminEmployeeMissedPage from "./pages/admin/AdminEmployeeMissedPage";
import AdminEmployeeAccountsPage from "./pages/admin/AdminEmployeeAccountsPage";
import AdminMeetingDetailsPage from "./pages/admin/AdminMeetingDetailsPage";
import AdminCallDetailsPage from "./pages/admin/AdminCallDetailsPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminCalendarDayPage from "./pages/admin/AdminCalendarDayPage";
import AdminClientsManagementPage from "./pages/admin/AdminClientsManagementPage";
import AdminAccountsEmployeesPage from "./pages/admin/accounts/AdminAccountsEmployeesPage";
import AdminAccountsEmployeeProfilePage from "./pages/admin/accounts/AdminAccountsEmployeeProfilePage";
import AdminAccountsMoneyInPage from "./pages/admin/accounts/AdminAccountsMoneyInPage";
import AdminAccountsBillsPage from "./pages/admin/accounts/AdminAccountsBillsPage";
import AdminAccountsExpensesPage from "./pages/admin/accounts/AdminAccountsExpensesPage";
import AdminAccountsExpenseDetailPage from "./pages/admin/accounts/AdminAccountsExpenseDetailPage";
import AdminAccountsVendorsPage from "./pages/admin/accounts/AdminAccountsVendorsPage";
import AdminAccountsVendorProfilePage from "./pages/admin/accounts/AdminAccountsVendorProfilePage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequirePasswordChange from "./components/RequirePasswordChange";
import BlockIfEmployeeSession from "./components/BlockIfEmployeeSession";

/*
 * Management scroll restoration
 * -----------------------------
 *
 * The Management page is a long shared sheet. Employees frequently open a
 * client's Meetings/Calls page, Calendar, Accounts, PDF screens, etc. and
 * then return to /management. React Router unmounts ManagementPage while
 * those routes are open, so relying on the browser's native scroll history
 * is not enough (main.jsx intentionally sets history.scrollRestoration to
 * "manual").
 *
 * ManagementPage already remembers its own scroll position, but the old
 * implementation could be overwritten with 0 when this component reset the
 * destination page to the top during a route change. This route-level backup
 * is deliberately independent: it remembers /management while the employee
 * is still on that route, refuses to record scroll events after the URL has
 * changed, and retries restoration while the Management rows are rendering.
 *
 * Keeping this at the app/router level means it works no matter which page
 * the employee visits before returning to /management.
 */
const MANAGEMENT_SCROLL_KEY = "mme_management_route_scroll_v2";
const MANAGEMENT_PATH = "/management";

function readManagementScrollY() {
  try {
    const raw = Number(sessionStorage.getItem(MANAGEMENT_SCROLL_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function writeManagementScrollY(value) {
  try {
    const y = Number(value);
    sessionStorage.setItem(
      MANAGEMENT_SCROLL_KEY,
      String(Number.isFinite(y) && y > 0 ? y : 0),
    );
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
    // Scroll restoration is a convenience feature, so never break routing.
  }
}

function clearManagementScrollY() {
  try {
    sessionStorage.removeItem(MANAGEMENT_SCROLL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

// history.scrollRestoration is set to "manual" in main.jsx. This component
// therefore owns route-level scroll behavior: non-management pages open at
// the top, while /management returns to the exact vertical position where the
// employee left it.
function ScrollToTop() {
  const location = useLocation();
  const restoringManagementRef = useRef(false);
  const restoreTimeoutsRef = useRef([]);

  // While actually on /management, continuously keep a route-level backup.
  // The pathname guard is important: when another route is opened, its own
  // scroll-to-top must never overwrite the saved Management position with 0.
  useEffect(() => {
    if (location.pathname !== MANAGEMENT_PATH) return undefined;

    let frame = 0;

    function saveCurrentManagementPosition() {
      if (window.location.pathname !== MANAGEMENT_PATH) return;
      if (restoringManagementRef.current) return;

      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (window.location.pathname !== MANAGEMENT_PATH) return;
        if (restoringManagementRef.current) return;
        writeManagementScrollY(window.scrollY);
      });
    }

    window.addEventListener("scroll", saveCurrentManagementPosition, {
      passive: true,
    });

    // pagehide covers refresh/tab close without depending on React cleanup.
    function handlePageHide() {
      if (window.location.pathname === MANAGEMENT_PATH) {
        writeManagementScrollY(window.scrollY);
      }
    }
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", saveCurrentManagementPosition);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [location.pathname]);

  useEffect(() => {
    // Cancel restoration attempts from the previous route change.
    for (const timeoutId of restoreTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    restoreTimeoutsRef.current = [];

    // A real logout/login starts a new employee workspace session, so don't
    // carry the previous employee's Management position into the next login.
    if (location.pathname === "/" || location.pathname === "/login") {
      restoringManagementRef.current = false;
      clearManagementScrollY();
      window.scrollTo(0, 0);
      return undefined;
    }

    if (location.pathname !== MANAGEMENT_PATH) {
      restoringManagementRef.current = false;
      window.scrollTo(0, 0);
      return undefined;
    }

    const targetY = readManagementScrollY();
    if (!targetY) {
      restoringManagementRef.current = false;
      return undefined;
    }

    restoringManagementRef.current = true;
    const startedAt = Date.now();

    // Management may first render cached rows and then refresh them from the
    // API. Restoring once can therefore be clamped if the document is still
    // short. Retry for a few seconds and stop immediately once the requested
    // position is genuinely reachable and has been restored.
    function attemptRestore() {
      if (window.location.pathname !== MANAGEMENT_PATH) {
        restoringManagementRef.current = false;
        return;
      }

      const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
      );
      const maxY = Math.max(0, pageHeight - window.innerHeight);
      const desiredY = Math.min(targetY, maxY);

      window.scrollTo({ top: desiredY, left: 0, behavior: "auto" });

      const targetIsReachable = maxY >= targetY - 2;
      const reachedTarget = Math.abs(window.scrollY - targetY) <= 3;
      const timedOut = Date.now() - startedAt >= 4500;

      if ((targetIsReachable && reachedTarget) || timedOut) {
        restoringManagementRef.current = false;
        writeManagementScrollY(window.scrollY);
        return;
      }

      const timeoutId = window.setTimeout(attemptRestore, 80);
      restoreTimeoutsRef.current.push(timeoutId);
    }

    // Two animation frames let React commit the Management route first.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(attemptRestore);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      for (const timeoutId of restoreTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      restoreTimeoutsRef.current = [];
    };
  }, [location.pathname]);

  return null;
}

// Access control for /management* and /calendar* is enforced server-side
// now (see server.js's page-fallback guard + the requireEmployee API
// middleware) — an unauthenticated request for these paths never reaches
// this router at all, it gets redirected to /login before the SPA loads.
//
// Conversely, while a valid employee session exists, every Admin Panel
// route is wrapped in BlockIfEmployeeSession so it bounces back to
// /management instead of loading — an employee must log out explicitly
// before the admin login screen (or any admin page) becomes reachable.
function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
        <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route path="/management" element={<RequirePasswordChange><ManagementPage /></RequirePasswordChange>} />
        <Route path="/management/meetings/:rowKey" element={<RequirePasswordChange><ClientMeetingsPage /></RequirePasswordChange>} />
        <Route path="/management/calls/:rowKey" element={<RequirePasswordChange><ClientCallsPage /></RequirePasswordChange>} />
        <Route path="/calendar" element={<RequirePasswordChange><CalendarPage /></RequirePasswordChange>} />
        <Route path="/calendar/day/:date" element={<RequirePasswordChange><CalendarDayPage /></RequirePasswordChange>} />
        <Route path="/accounts" element={<RequirePasswordChange><AccountsPage /></RequirePasswordChange>} />
        <Route path="/accounts/money-in" element={<RequirePasswordChange><MoneyInPage /></RequirePasswordChange>} />
        <Route path="/accounts/log-cost" element={<RequirePasswordChange><LogCostPage /></RequirePasswordChange>} />
        <Route path="/accounts/vendors" element={<RequirePasswordChange><VendorsPage /></RequirePasswordChange>} />
        <Route path="/accounts/vendors/:id" element={<RequirePasswordChange><VendorProfilePage /></RequirePasswordChange>} />
        <Route path="/management/meetings/:rowKey/:meetingId/pdf" element={<RequirePasswordChange><PDFGeneratorPage /></RequirePasswordChange>} />
        <Route path="/pdf-generator" element={<Navigate to="/management" replace />} />
        <Route path="/pdf-generator/preview" element={<RequirePasswordChange><PDFPreviewPage /></RequirePasswordChange>} />
        <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
        <Route path="/admin-dashboard" element={<BlockIfEmployeeSession><AdminDashboardPage /></BlockIfEmployeeSession>} />
        <Route path="/admin-dashboard/clients/:rowKey" element={<BlockIfEmployeeSession><AdminClientDetailPage /></BlockIfEmployeeSession>} />
        <Route path="/admin-employee-management" element={<BlockIfEmployeeSession><AdminPage /></BlockIfEmployeeSession>} />
        <Route path="/admin-employee-management/accounts" element={<BlockIfEmployeeSession><AdminEmployeeAccountsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin-employee-management/:employeeId/missed" element={<BlockIfEmployeeSession><AdminEmployeeMissedPage /></BlockIfEmployeeSession>} />
        <Route path="/admin-employee-management/:employeeId" element={<BlockIfEmployeeSession><AdminEmployeeDetailPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/login" element={<BlockIfEmployeeSession><AdminLoginPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/activity" element={<BlockIfEmployeeSession><AdminActivityPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/activity/meetings/:rowKey" element={<BlockIfEmployeeSession><AdminMeetingDetailsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/activity/calls/:rowKey" element={<BlockIfEmployeeSession><AdminCallDetailsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/calendar" element={<BlockIfEmployeeSession><AdminCalendarPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/calendar/day/:date" element={<BlockIfEmployeeSession><AdminCalendarDayPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/clients-management" element={<BlockIfEmployeeSession><AdminClientsManagementPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/attendance" element={<BlockIfEmployeeSession><AdminAttendancePage /></BlockIfEmployeeSession>} />

        {/* Admin Financial Accounts — distinct from /admin-employee-management/accounts,
            which manages employee login accounts rather than money. Money In is the
            landing page: recent wallet top-ups, newest first. */}
        <Route path="/admin/accounts" element={<Navigate to="/admin/accounts/money-in" replace />} />
        <Route path="/admin/accounts/employees" element={<BlockIfEmployeeSession><AdminAccountsEmployeesPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/employees/:employeeId" element={<BlockIfEmployeeSession><AdminAccountsEmployeeProfilePage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/money-in" element={<BlockIfEmployeeSession><AdminAccountsMoneyInPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/bills" element={<BlockIfEmployeeSession><AdminAccountsBillsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/expenses" element={<BlockIfEmployeeSession><AdminAccountsExpensesPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/expenses/:expenseId" element={<BlockIfEmployeeSession><AdminAccountsExpenseDetailPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/vendors" element={<BlockIfEmployeeSession><AdminAccountsVendorsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/vendors/:vendorId" element={<BlockIfEmployeeSession><AdminAccountsVendorProfilePage /></BlockIfEmployeeSession>} />

        {/* Money Receipt Generator — Admin-only official payment receipts, fully
            isolated from the employee-facing PDF Generator module (see
            MoneyReceiptGenerator/). Backend enforces requireAdmin on every
            /api/admin/money-receipts endpoint regardless of what happens here. */}
        <Route path="/admin/money-receipts" element={<BlockIfEmployeeSession><MoneyReceiptGeneratorPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/money-receipts/preview" element={<BlockIfEmployeeSession><MoneyReceiptPreviewPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/money-receipts/history" element={<BlockIfEmployeeSession><MoneyReceiptHistoryPage /></BlockIfEmployeeSession>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
