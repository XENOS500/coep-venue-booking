import { Navigate, Outlet, Route, Routes, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { ManageAccounts } from "./pages/Accounts";
import { Dashboard } from "./pages/Dashboard";
import { Catalog, VenueDetails } from "./pages/Catalog";
import { BookingForm } from "./pages/BookingForm";
import { Bookings, BookingDetails } from "./pages/Bookings";
import { lazy, Suspense } from "react";
import { Loading } from "./components/UI";
const LazyCalendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
function Calendar() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyCalendar />
    </Suspense>
  );
}
import { ManageVenues, AssignApprovers } from "./pages/Admin";
function Guard({ roles }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(account.role))
    return (
      <div className="state">
        <h1>Access restricted</h1>
        <p>This page is not available for your role.</p>
        <Link to="/dashboard" className="button">
          Return to overview
        </Link>
      </div>
    );
  return <Outlet />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Guard />}>
        <Route element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="venues" element={<Catalog />} />
          <Route path="venues/:id" element={<VenueDetails />} />
          <Route
            path="availability"
            element={<BookingForm availabilityOnly />}
          />
          <Route path="calendar" element={<Calendar />} />
          <Route element={<Guard roles={["REQUESTER"]} />}>
            <Route path="bookings/new" element={<BookingForm />} />
            <Route path="my-bookings" element={<Bookings />} />
          </Route>
          <Route element={<Guard roles={["REQUESTER", "APPROVER"]} />}>
            <Route path="bookings/:id" element={<BookingDetails />} />
          </Route>
          <Route element={<Guard roles={["APPROVER"]} />}>
            <Route
              path="approvals/pending"
              element={<Bookings mode="pending" />}
            />
            <Route
              path="approvals/history"
              element={<Bookings mode="history" />}
            />
          </Route>
          <Route element={<Guard roles={["ADMIN"]} />}>
            <Route path="admin/venues" element={<ManageVenues />} />
            <Route path="admin/accounts" element={<ManageAccounts />} />
            <Route path="admin/approvers" element={<AssignApprovers />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="state">
                <h1>Page not found</h1>
                <Link to="/dashboard" className="button">
                  Return to overview
                </Link>
              </div>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
