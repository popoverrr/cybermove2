// Company name rule (docs/14-rework.md §12): always «Cyber Move Consulting» (upper case in logos/labels),
// never «CYBERMOVE»/«Cybermove» — except the domain, URLs/slugs and the product name CYBERMOVE GAMES.
export function brand(text) {
  return String(text)
    .replace(/CYBERMOVE\s*·\s*Cyber Move Consulting/g, 'Cyber Move Consulting')
    .replace(/CYBERMOVE(?!\s+GAMES)/g, 'Cyber Move Consulting')
    .replace(/Cybermove(?!\s+Games)(?![\w-]*\.(asia|ru|kz))/g, 'Cyber Move Consulting');
}
