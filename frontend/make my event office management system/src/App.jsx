import { useEffect } from "react";
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
import AdminAccountsOverviewPage from "./pages/admin/accounts/AdminAccountsOverviewPage";
import AdminAccountsEmployeesPage from "./pages/admin/accounts/AdminAccountsEmployeesPage";
import AdminAccountsEmployeeProfilePage from "./pages/admin/accounts/AdminAccountsEmployeeProfilePage";
import AdminAccountsMoneyInPage from "./pages/admin/accounts/AdminAccountsMoneyInPage";
import AdminAccountsExpensesPage from "./pages/admin/accounts/AdminAccountsExpensesPage";
import AdminAccountsExpenseDetailPage from "./pages/admin/accounts/AdminAccountsExpenseDetailPage";
import AdminAccountsEventsPage from "./pages/admin/accounts/AdminAccountsEventsPage";
import AdminAccountsVendorsPage from "./pages/admin/accounts/AdminAccountsVendorsPage";
import AdminAccountsVendorProfilePage from "./pages/admin/accounts/AdminAccountsVendorProfilePage";
import AdminAccountsAuditPage from "./pages/admin/accounts/AdminAccountsAuditPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequirePasswordChange from "./components/RequirePasswordChange";
import BlockIfEmployeeSession from "./components/BlockIfEmployeeSession";

// history.scrollRestoration is set to "manual" in main.jsx, so nothing
// scrolls automatically anymore — reset to the top on every route change
// except /management, which restores its own remembered scroll position
// (see ManagementPage) instead of always jumping to the top.
function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/management") return;
    window.scrollTo(0, 0);
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
            which manages employee login accounts rather than money. */}
        <Route path="/admin/accounts" element={<BlockIfEmployeeSession><AdminAccountsOverviewPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/employees" element={<BlockIfEmployeeSession><AdminAccountsEmployeesPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/employees/:employeeId" element={<BlockIfEmployeeSession><AdminAccountsEmployeeProfilePage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/money-in" element={<BlockIfEmployeeSession><AdminAccountsMoneyInPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/expenses" element={<BlockIfEmployeeSession><AdminAccountsExpensesPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/expenses/:expenseId" element={<BlockIfEmployeeSession><AdminAccountsExpenseDetailPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/events" element={<BlockIfEmployeeSession><AdminAccountsEventsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/vendors" element={<BlockIfEmployeeSession><AdminAccountsVendorsPage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/vendors/:vendorId" element={<BlockIfEmployeeSession><AdminAccountsVendorProfilePage /></BlockIfEmployeeSession>} />
        <Route path="/admin/accounts/audit" element={<BlockIfEmployeeSession><AdminAccountsAuditPage /></BlockIfEmployeeSession>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;

