import { Building2 } from "lucide-react";
import { PublicInfoLinks } from "./PublicInfoLinks";

export function Footer() {
  return (
    <footer className="campus-footer">
      <div className="campus-footer-inner">
        <div className="campus-footer-top">
          <div>
            <a className="footer-brand" href="/">
              <Building2 size={23} aria-hidden="true" />
              <span>COEP <strong>Spaces</strong></span>
            </a>
            <p className="footer-description">A space for every idea. A campus, connected.</p>
          </div>
          <PublicInfoLinks />
        </div>
        <div className="campus-footer-bottom">
          <span>COEP Technological University · Campus venue booking</span>
          <span>Thoughtfully shared. Seamlessly booked.</span>
        </div>
      </div>
    </footer>
  );
}
