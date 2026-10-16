import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Users, Building2 } from "lucide-react";
import placeholder from "../assets/venue-placeholder.svg";
export const value = (v) => v || "Not provided";

/** Resolve imported sharing links into URLs that an image element can use. */
export function displayImageUrl(venue) {
  if (venue.imageUrl) return venue.imageUrl;

  const source = venue.imageSourceUrl || "";
  const driveFile = source.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFile) {
    return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  }

  // SharePoint :i: links identify an image; :f: links identify folders.
  if (/sharepoint\.com/i.test(source) && /:i:/i.test(source)) {
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}download=1`;
  }

  // A SharePoint folder is a navigation page, so it cannot be used as an
  // image source until an individual file is selected by an administrator.
  if (/sharepoint\.com/i.test(source) && /:f:/i.test(source)) return null;

  return source || null;
}

export function VenueImage({ venue, className = "" }) {
  const imageUrl = displayImageUrl(venue);

  return (
    <div className={`venue-image ${className}`}>
      <img
        src={imageUrl || placeholder}
        alt={
          imageUrl
            ? `${venue.name} venue photo`
            : "Campus building illustration; venue photo not verified"
        }
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = placeholder;
        }}
      />
      {!imageUrl && (
        <span className="image-caption">VENUE PHOTO PENDING</span>
      )}
    </div>
  );
}
export function VenueCard({ venue }) {
  return (
    <article className="venue-card">
      <Link
        to={`/venues/${venue.id}`}
        className="image-link"
        aria-label={`View ${venue.name}`}
      >
        <VenueImage venue={venue} />
      </Link>
      <div className="venue-card-body">
        <div className="card-meta">
          <span>{value(venue.venueType)}</span>
          <span className={`eligibility ${venue.eligible ? "ready" : ""}`}>
            {venue.eligible
              ? "Bookable"
              : venue.isActive
                ? "Setup pending"
                : "Inactive"}
          </span>
        </div>
        <Link className="venue-title" to={`/venues/${venue.id}`}>
          <h3>{venue.name}</h3>
          <ArrowUpRight size={20} />
        </Link>
        <p className="venue-location">
          <MapPin size={14} />
          {value(venue.buildingName)}
        </p>
        <div className="venue-facts">
          <span>
            <Users size={15} />
            {venue.capacity
              ? `${venue.capacity} guests`
              : "Capacity not provided"}
          </span>
          <span>
            <Building2 size={15} />
            {value(venue.floor)}
          </span>
        </div>
        <p className="feature-line">{value(venue.features)}</p>
      </div>
    </article>
  );
}
