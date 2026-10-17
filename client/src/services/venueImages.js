// Vite emits these photos as public, content-hashed assets. Visitors never
// need a Google/SharePoint session to load a bundled venue photo.
const photos = import.meta.glob("../assets/venues/venue-*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export function bundledVenueImage(venue) {
  // Imported serial numbers are stable across database seeds and environments.
  // Names can be edited and database UUIDs differ between local and Neon.
  return photos[`../assets/venues/venue-${venue.sourceSerial}.png`] || null;
}
