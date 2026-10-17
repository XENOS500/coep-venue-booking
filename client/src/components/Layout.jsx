import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  SearchCheck,
  Plus,
  ClipboardList,
  CircleCheck,
  History,
  Settings2,
  UserRoundCheck,
  LogOut,
  Menu,
  X,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Modal } from "./UI";
import { Footer } from "./Footer";
export const navigation = [
  { to: "/admin/accounts", label: "Manage accounts", icon: UserRoundCheck, roles: ["ADMIN"] },
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/venues", label: "Venue catalog", icon: Building2 },
  { to: "/availability", label: "Check availability", icon: SearchCheck },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  {
    to: "/bookings/new",
    label: "New booking",
    icon: Plus,
    roles: ["REQUESTER"],
  },
  {
    to: "/my-bookings",
    label: "My bookings",
    icon: ClipboardList,
    roles: ["REQUESTER"],
  },
  {
    to: "/approvals/pending",
    label: "Pending requests",
    icon: CircleCheck,
    roles: ["APPROVER"],
  },
  {
    to: "/approvals/history",
    label: "Approval history",
    icon: History,
    roles: ["APPROVER"],
  },
  {
    to: "/admin/venues",
    label: "Manage venues",
    icon: Settings2,
    roles: ["ADMIN"],
  },
  {
    to: "/admin/approvers",
    label: "Assign approvers",
    icon: UserRoundCheck,
    roles: ["ADMIN"],
  },
];
export function Layout() {
  const { account, logout } = useAuth(),
    navigate = useNavigate();
  const [menu, setMenu] = useState(false),
    [profile, setProfile] = useState(false);
  const links = navigation.filter(
    (n) => !n.roles || n.roles.includes(account.role),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <NavLink
          to="/dashboard"
          className="brand"
          onClick={() => setMenu(false)}
        >
          <span className="brand-icon">
            <Building2 size={25} />
          </span>
          <span>
            COEP <b>Spaces</b>
            <small>CAMPUS VENUE BOOKING</small>
          </span>
        </NavLink>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="sidebar-scroll">
          <p className="nav-section">WORKSPACE</p>
          <nav id="campus-navigation" aria-label="Main navigation">
            {links.map(({ icon: Icon, ...n }) => (
              <NavLink key={n.to} to={n.to} onClick={() => setMenu(false)}>
                <Icon size={19} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="tiny-label">A SPACE FOR EVERY IDEA</span>
            <p>Bring your next campus event to life.</p>
            <NavLink to="/venues">
              Explore venues <ArrowUpRight size={16} />
            </NavLink>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="profile-button" aria-label="Open your profile" onClick={() => setProfile(true)}>
            <span className="avatar">{account.name.slice(0, 1)}</span>
            <span>
              <b>{account.name}</b>
              <small>{account.role.toLowerCase()}</small>
            </span>
            <UserRound size={17} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              aria-controls="campus-navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="topbar-label">Campus workspace</span>
            <span className="topbar-divider">/</span>
            <span>Venue booking</span>
          </div>
          <span className="timezone">
            <span />
            Asia/Kolkata
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
      {profile && (
        <Modal title="Your profile" onClose={() => setProfile(false)}>
          <dl className="details-list">
            <dt>Name</dt>
            <dd>{account.name}</dd>
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>Role</dt>
            <dd>{account.role}</dd>
          </dl>
          <p className="muted">
            Account changes are handled by your institution’s authorized
            maintenance team.
          </p>
          <button
            className="button danger"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </Modal>
      )}
    </div>
  );
}
