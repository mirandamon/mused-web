import { createEmptyPads } from '@/lib/pads';
import type { Fragment, Pad, PadSound, Sound } from '@/lib/types';

const API_URL = process.env.EXPO_PUBLIC_MUSED_API_URL;

function ensureApiUrl() {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_MUSED_API_URL environment variable.');
  }
  return API_URL;
}

function normalizePadSound(sound: PadSound, fallbackId: string, color?: string): PadSound {
  return {
    soundId: sound.soundId ?? fallbackId,
    soundName: sound.soundName ?? 'Untitled',
    soundUrl: sound.soundUrl,
    downloadUrl: sound.downloadUrl,
    source: sound.source,
    color: color ?? sound.color,
    asset: sound.asset,
    localUri: sound.localUri,
  };
}

function normalizePad(pad: Partial<Pad>, index: number): Pad {
  const sounds = (pad.sounds ?? []).map((sound, soundIndex) =>
    normalizePadSound(sound, `${index}-${soundIndex}`, sound.color)
  );

  return {
    id: pad.id ?? index,
    sounds,
    isActive: pad.isActive ?? sounds.length > 0,
    currentSoundIndex: pad.currentSoundIndex ?? 0,
  };
}

function normalizeFragment(fragment: Fragment): Fragment {
  const pads = fragment.pads && fragment.pads.length > 0
    ? fragment.pads.map((pad, index) => normalizePad(pad, index))
    : createEmptyPads();

  return {
    ...fragment,
    pads,
    timestamp: fragment.timestamp ? new Date(fragment.timestamp) : new Date(),
    comments: (fragment.comments ?? []).map((comment) => ({
      ...comment,
      timestamp: comment.timestamp ? new Date(comment.timestamp) : new Date(),
    })),
  };
}

export async function fetchFragments() {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}/fragments?limit=10`);
  if (!response.ok) {
    throw new Error(`Failed to fetch fragments (${response.status})`);
  }

  const payload = await response.json();
  const fragments: Fragment[] = (payload.fragments ?? payload) as Fragment[];
  return fragments.map(normalizeFragment);
}

export async function fetchFragmentById(id: string) {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}/fragments/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch fragment ${id} (${response.status})`);
  }

  const fragment = (await response.json()) as Fragment;
  return normalizeFragment(fragment);
}

export async function fetchSounds(): Promise<Sound[]> {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}/sounds?limit=50`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sounds (${response.status})`);
  }

  const payload = await response.json();
  return (payload.sounds ?? payload).map((sound: Sound) => ({
    ...sound,
    type: sound.type ?? (sound.source_type === 'predefined' ? 'predefined' : 'marketplace'),
  }));
}
