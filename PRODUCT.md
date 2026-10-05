# Product

## Register

product

## Users

This is a local-first private restaurant map for one person maintaining a long-term food archive. The user is usually managing places from a desktop browser, checking the map, filtering by status, category, tag, score, and price, then opening a place profile to edit details or record visits. Mobile use must support basic browsing, filtering, and details, but the primary workflow is still focused desktop organization.

## Product Purpose

The product records visited and wishlist restaurants as a durable personal database. It links map positions, categories, tags, ratings, average price, notes, visits, photos, local storage, and backup import/export into one usable workflow. Success means the user can add, find, compare, edit, and preserve restaurant records without accounts, cloud sync, or social publishing.

## Brand Personality

Editorial, restrained, practical. The interface should feel like a high-end city food guide used as a personal tool: clear enough for repeated use, polished enough to enjoy maintaining, and quiet enough that the map and restaurant records remain the focus.

## Anti-references

Avoid marketing-style hero layouts, generic SaaS dashboards, purple-blue AI gradients, decorative blobs, overbuilt animation, and settings-page clutter inside high-frequency task flows. Avoid turning local category and tag editing into a heavy admin screen when the user's main task is filtering or editing a place.

## Design Principles

1. Keep the map as the first visual subject.
2. Let filtering and editing stay fast, with advanced organization behind progressive disclosure.
3. Use familiar product UI controls before inventing new affordances.
4. Treat data integrity and recovery as part of the experience, not hidden plumbing.
5. Use motion only to explain state changes or preserve orientation.

## Accessibility & Inclusion

Interactive controls need visible labels or `aria-label` values, keyboard focus must remain visible, destructive actions need confirmation, and motion must respect `prefers-reduced-motion`. Touch targets should remain usable on mobile, and text, chips, buttons, and form controls must not overflow at narrow widths.
