# Bundled venue photos

The 19 PNGs supplied in `venues.zip` are stored unchanged under
`client/src/assets/venues/`. Vite emits public, content-hashed files into the
frontend build, so these photos work without Google/SharePoint cookies,
including in incognito. Both catalog cards and venue details use them.

The file suffix is the imported catalog's `sourceSerial`, not the database
UUID. Bundled photos take precedence over external image URLs so existing
private links cannot hide these photos. No database update or seed is needed.

| Serial | Venue | Original filename |
| --- | --- | --- |
| 1 | NC 01 | NC 01.png |
| 2 | NC 02 | NC 02.png |
| 3 | NC 03 | NC 03.png |
| 4 | NC 04 | NC 04.png |
| 5 | NC 05 | NC 05.png |
| 6 | NC 06 | NC 06.png |
| 7 | NC 07 | NC 07.png |
| 8 | NC 08 | NC 08.png |
| 9 | Seminar Hall (E&TC Extension Building) | SEMINAR HALL.png |
| 15 | Seminar Hall I (Instrumentation and Control Engineering) | SEMINAR HALL I.png |
| 16 | Class Room (Instrumentation and Control Engineering) | Class Room.png |
| 17 | Seminar Hall II (Instrumentation and Control Engineering) | SEMINAR HALL II.png |
| 18 | basement (Fluid Lab) | basement (Fluid Lab).png |
| 19 | Class Room 1 (Applied Mech) | Class Room 1.png |
| 21 | Class Room No 1 (Applied Mech) | Class Room No 1.png |
| 22 | Applied Mech Seminar Hall | Applied Mech Seminar Hall.png |
| 23 | Class Room No 22 | Class Room No 22.png |
| 42 | Classroom Environment Lab | Classroom Environment Lab.png |
| 46 | 1st floor (Geotech classroom) | 1st floor (Geotech classroom).png |

The remaining 42 catalog records have no supplied photo. They retain the
existing external image resolution and placeholder fallback; private external
sources can still fail for those records. Do not reuse another room's photo
unless its mapping is explicitly confirmed.

To add a photo, verify its catalog serial and add
`client/src/assets/venues/venue-SERIAL.png`, then rebuild the frontend. Deploy
the frontend from the branch containing the images and resolver changes.
Render and Neon require no changes for these bundled photos.
