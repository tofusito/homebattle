# Happy Home visual identity

Happy Home keeps its friendly household tone with a quieter, clearer interface. The main brand colour is sky blue; white surfaces and dark blue-grey text carry the content. Lucy, Manu, task status, and rescues retain their own colours only where those colours explain meaning.

## App icon

`public/icons/happy-home-sky-master.png` is the source asset. It was generated from this brief, using Nutri Diary's dimensional, single-subject app icon as a style reference: a cream-white house with a warm door and small golden sparkle on a sky-blue field, readable at Home Screen size. It is new artwork, not a reuse of Nutri Diary's bowl.

The 64, 180, 192, and 512 pixel derivatives are referenced by the favicon, Apple touch metadata, PWA manifest, service worker, and reminder notifications. When changing these assets, update the cache name in `public/sw.js` and the versioned URLs in the manifest and document head. Existing iOS Home Screen shortcuts may need to be removed and added again before the system displays the new icon.

## Interface

- Keep the personal Today view and task order; improve hierarchy through spacing and typography rather than extra panels.
- Use white cards on a near-white blue background in light mode, and deep blue-grey surfaces in dark mode.
- Reserve the strongest blue for active actions and navigation; do not colour whole task cards by status.
- Keep actionable targets clear and focus rings visible. Respect reduced-motion preferences.
