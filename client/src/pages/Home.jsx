import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, CalendarDays,
  Check, ClipboardCheck, MailCheck, MapPin, Menu, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, UsersRound, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Footer } from "../components/Footer";
import classroomPhoto from "../assets/venues/venue-6.png";
import seminarPhoto from "../assets/venues/venue-22.png";
import seminarOnePhoto from "../assets/venues/venue-15.png";
import "./home.css";

const steps = [
  { icon: Search, title: "Find the right fit", description: "Sign in to explore venue photos, room details and capacity. Check the calendar for a time that works." },
  { icon: CalendarDays, title: "Tell us your plan", description: "Choose your dates and times, add your event details, and submit a single-date or recurring booking request." },
  { icon: MailCheck, title: "Keep everyone in the loop", description: "Track the request in your workspace. The assigned approver's decision is also emailed to your booking contact." },
];
const venues = [
  { name: "NC 06", category: "CLASSROOM", location: "Academic Complex Building", image: classroomPhoto, alt: "Rows of desks facing the chalkboards and projector in NC 06" },
  { name: "Applied Mech Seminar Hall", category: "SEMINAR HALL", location: "Applied Mechanics", image: seminarPhoto, alt: "Red writing chairs and a projector in the Applied Mechanics seminar hall" },
  { name: "Seminar Hall I", category: "SEMINAR HALL", location: "Instrumentation & Control Engineering", image: seminarOnePhoto, alt: "Seating and presentation boards in Seminar Hall I" },
];
const roles = [
  { icon: UsersRound, name: "Requesters", label: "BRING THE IDEA", description: "Find a venue, send a booking request and follow its progress. Create your account with an email address you can verify.", detail: "Self-registration with email verification" },
  { icon: ClipboardCheck, name: "Approvers", label: "MAKE IT POSSIBLE", description: "Review requests for your assigned venues. Approve or reject with a clear decision and keep the booking history in one place.", detail: "Access granted by the administrator" },
  { icon: SlidersHorizontal, name: "Administrator", label: "KEEP IT RUNNING", description: "Manage venue details and booking settings, grant approver access, and assign the authorities responsible for each space.", detail: "Institution-managed administrator account" },
];
const questions = [
  ["Do I need an account to book a venue?", "Yes. Register as a Requester and verify your email, then sign in to browse the venue catalog, check availability and submit requests. Approvers receive their access from the administrator."],
  ["Is my venue confirmed as soon as I submit?", "A submitted request is pending until the assigned approver approves it. Pending requests hold the requested slots while awaiting a decision. Check your booking status before making final event arrangements."],
  ["Can I use an email outside the college domain?", "Yes. Requester registration accepts Gmail, Yahoo, college mail and other valid email addresses. You must be able to receive the verification code. Approver accounts are provided by the administrator using college email addresses."],
  ["Can I request a venue for more than one date?", "Yes. You can submit a single-date request or select weekdays within a date range for a recurring event. Every occurrence is checked for availability, and the request is reviewed as one series."],
];

export function Home() {
  const { account } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const workspacePath = account ? "/dashboard" : "/login";
  const catalogPath = account ? "/venues" : "/login";
  useEffect(() => {
    const previous = document.title;
    document.title = "COEP Spaces | Find your campus space";
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event) { if (event.key === "Escape") setMenuOpen(false); }
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [menuOpen]);
  function closeMenu() { setMenuOpen(false); }

  return (
    <div className="landing-page">
      <a className="skip-link" href="#home-content">Skip to content</a>
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="brand landing-brand" aria-label="COEP Spaces home" onClick={closeMenu}>
            <span className="brand-icon"><Building2 size={24} aria-hidden="true" /></span>
            <span>COEP <b>Spaces</b><small>CAMPUS VENUE BOOKING</small></span>
          </Link>
          <nav className={`landing-nav ${menuOpen ? "is-open" : ""}`} id="home-navigation" aria-label="Homepage navigation">
            <a href="#spaces" onClick={closeMenu}>Our spaces</a>
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#who-its-for" onClick={closeMenu}>Who it’s for</a>
            <a href="#questions" onClick={closeMenu}>FAQs</a>
          </nav>
          <div className="landing-header-actions">
            {account ? <Link to="/dashboard" className="landing-signin">Overview <ArrowUpRight size={16} /></Link> : <>
              <Link to="/login" className="landing-signin">Sign in</Link>
              <Link to="/register" className="button landing-nav-cta">Get started <ArrowUpRight size={16} /></Link>
            </>}
            <button type="button" className="icon-button landing-menu" aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(value => !value)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main id="home-content" className="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="home-title">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span /> COEP TECHNOLOGICAL UNIVERSITY</p>
            <h1 id="home-title">Big ideas.<br />Better <em>spaces.</em></h1>
            <p className="landing-hero-description">A workshop that sparks something. A seminar that brings people together. Find the right campus space for whatever you’re planning next.</p>
            <div className="landing-hero-actions">
              <Link to={catalogPath} className="button landing-primary">Find your space <ArrowRight size={18} /></Link>
              <a href="#how-it-works" className="landing-secondary">See how it works <ArrowDown size={16} /></a>
            </div>
            <p className="landing-hero-note"><ShieldCheck size={16} /> Clear availability. Thoughtful approvals. One workspace.</p>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-photo-frame">
              <img src={classroomPhoto} width="1070" height="480" alt="Sunlit desks, a projector and chalkboards inside NC 06 at COEP" fetchPriority="high" />
              <div className="landing-photo-shade" />
              <div className="landing-photo-caption"><span>ROOM FOR WHAT’S NEXT</span><strong>Your next chapter<br />starts here.</strong></div>
              <span className="landing-photo-location"><MapPin size={13} /> Academic Complex</span>
            </div>
            <Link to={catalogPath} className="landing-photo-tag"><span><Building2 size={21} /></span><div><strong>Real spaces. Real possibilities.</strong><small>Explore venues across your campus.</small></div><ArrowUpRight size={19} /></Link>
            <span className="landing-visual-index" aria-hidden="true">01 / THE CAMPUS WORKSPACE</span>
          </div>
        </section>

        <div className="landing-promises" aria-label="Platform features">
          <span><Building2 size={18} /> Campus venue catalog</span><span><CalendarDays size={18} /> Single & recurring bookings</span><span><ClipboardCheck size={18} /> Assigned approver review</span><span><MailCheck size={18} /> Decisions in your inbox</span>
        </div>

        <section className="landing-section landing-spaces" id="spaces" aria-labelledby="spaces-title">
          <div className="landing-section-heading"><div><p className="landing-kicker">A PLACE FOR EVERY POSSIBILITY</p><h2 id="spaces-title">Find a space that fits your idea.</h2></div><Link to={catalogPath} className="landing-inline-link">Explore the venue catalog <ArrowUpRight size={17} /></Link></div>
          <div className="landing-venue-grid">
            {venues.map(venue => <article className="landing-venue" key={venue.name}>
              <div className="landing-venue-photo"><img src={venue.image} alt={venue.alt} loading="lazy" width="640" height="420" /><span>{venue.category}</span></div>
              <div className="landing-venue-info"><h3>{venue.name}</h3><p><MapPin size={13} />{venue.location}</p></div>
            </article>)}
          </div>
          <p className="landing-section-note">A glimpse of our campus venues. Sign in for current room details, availability and booking access.</p>
        </section>

        <section className="landing-process-wrap" id="how-it-works" aria-labelledby="process-title">
          <div className="landing-section landing-process">
            <div className="landing-section-heading"><div><p className="landing-kicker">LESS BACK-AND-FORTH. MORE POSSIBILITIES.</p><h2 id="process-title">From an idea to a booked space.</h2></div><p>A clear path from your first search<br className="landing-desktop-break" /> to your approver’s decision.</p></div>
            <div className="landing-step-grid">{steps.map(({ icon: Icon, title, description }, index) => <article className="landing-step" key={title}>
              <div className="landing-step-top"><span className="landing-step-icon"><Icon size={24} /></span><span className="landing-step-number">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p>
            </article>)}</div>
            <p className="landing-process-note"><ShieldCheck size={17} /> Every booking request needs approval. Your workspace keeps the status clear.</p>
          </div>
        </section>

        <section className="landing-section" id="who-its-for" aria-labelledby="roles-title">
          <div className="landing-section-heading"><div><p className="landing-kicker">ONE CAMPUS. A SHARED WORKSPACE.</p><h2 id="roles-title">The right tools for your role.</h2></div></div>
          <div className="landing-role-grid">{roles.map(({ icon: Icon, name, label, description, detail }, index) => <article className={`landing-role ${index === 0 ? "landing-role-featured" : ""}`} key={name}>
            <Icon size={27} /><p className="landing-role-label">{label}</p><h3>{name}</h3><p>{description}</p><div className="landing-role-detail"><Check size={15} />{detail}</div>
          </article>)}</div>
        </section>

        <section className="landing-section landing-faq" id="questions" aria-labelledby="faq-title">
          <div><p className="landing-kicker">BEFORE YOU GET STARTED</p><h2 id="faq-title">A few things<br />worth knowing.</h2><p>Still have a question?<br /><a href="mailto:pareekayush500@gmail.com">Get in touch <ArrowUpRight size={14} /></a></p></div>
          <div className="landing-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="landing-section landing-final" aria-labelledby="get-started-title">
          <div className="landing-final-inner"><div><p className="landing-kicker"><Sparkles size={15} /> YOUR NEXT IDEA BELONGS SOMEWHERE</p><h2 id="get-started-title">Let’s make room<br />for what’s next.</h2><p>Your campus has the space. You bring the possibility.</p></div><div className="landing-final-actions">
            <Link to={account ? workspacePath : "/register"} className="button">{account ? "Open your workspace" : "Create a requester account"}<ArrowRight size={18} /></Link>
            {!account && <Link to="/login">Already have an account? <strong>Sign in <ArrowUpRight size={14} /></strong></Link>}
          </div></div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
