

## Plan: Tablet Layout Fixes + Installable Web App (PWA)

### Part 1: Tablet Layout Fixes for Court Manager

The `/manage` page uses `max-w-6xl` (1152px) which works on desktop but on a 10.1" Android tablet in landscape (~1280x800px), the combination of padding and max-width can cause awkward spacing or overflow. Key fixes:

- **Manage page container**: Replace `max-w-6xl` with responsive width that fills the tablet screen properly, using `max-w-full` on tablet-sized screens with appropriate padding
- **Court cards**: The two courts side-by-side (`md:flex-row`) can feel cramped on a 10.1" tablet. Ensure the `p-8` padding scales down slightly on smaller tablets so content fits without scrolling horizontally
- **All Pairs grid**: Currently `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` -- on a landscape tablet this may show too few columns. Adjust breakpoints so the grid uses available space better
- **Tab bar**: Ensure the tab navigation doesn't overflow or require horizontal scrolling on the tablet width
- **On Deck / Up Next sections**: Ensure text wrapping is clean on tablet widths (no awkward line breaks mid-name)
- **Fullscreen mode**: Verify spacing works well in fullscreen on the tablet resolution

### Part 2: Progressive Web App (PWA) Setup

This will let anyone "install" the app to their home screen from the browser -- it works on both Android and iOS, no app store needed.

**What gets set up:**
- Install `vite-plugin-pwa` dependency
- Configure PWA plugin in `vite.config.ts` with app manifest (name: "Club PTO", theme colors matching the dark design)
- Add mobile-optimized meta tags to `index.html` (theme-color, apple-touch-icon, etc.)
- Create PWA icons in the `public/` folder (192x192 and 512x512)
- Create an `/install` page with instructions for adding to home screen
- Add the `/~oauth` route to the service worker's `navigateFallbackDenylist`

**Result:** Users visit the site on their Android tablet (or any phone), tap "Add to Home Screen" from the browser menu, and the app launches in full screen without browser chrome -- looking and feeling like a native app.

### Technical Details

**Files to create:**
- `public/pwa-192x192.png` and `public/pwa-512x512.png` -- PWA icons
- `src/pages/Install.tsx` -- install instructions page

**Files to modify:**
- `vite.config.ts` -- add VitePWA plugin config
- `index.html` -- add meta tags (theme-color, apple-mobile-web-app-capable, icons)
- `src/App.tsx` -- add `/install` route
- `src/pages/Manage.tsx` -- adjust container widths and padding for tablet
- `src/components/manage/CourtDisplay.tsx` -- responsive tweaks for tablet grid/spacing
- `src/index.css` -- add tablet-specific utility classes if needed

