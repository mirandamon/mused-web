// src/lib/placeholder-data.ts
import type { Fragment, Pad, PadSound, Sound } from './types';

// Note: Color assignment is now done on the client-side in components like FragmentEditor and FragmentPost

// Placeholder fragments are removed. Data will be fetched from the API.
export const placeholderFragments: Fragment[] = [];

// Removed generatePads function and sound mappings as they are no longer needed
// for static placeholder data. The API now handles pad/sound structure.
