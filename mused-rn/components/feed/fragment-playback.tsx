import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Audio, InterruptionModeAndroid } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadURL, ref } from 'firebase/storage';

import type { Fragment, Pad, PadSound } from '@/lib/types';
import { normalizePadColor } from '@/lib/colors';
import { useSoundColors } from '@/hooks/use-sound-colors';
import { storage } from '@/app/lib/firebase';

interface FragmentPlaybackProps {
  fragment: Fragment;
}

type SoundCache = Map<string, Audio.Sound>;

type UrlCache = Map<string, string>;

type UrlPromiseCache = Map<string, Promise<string | null>>;

type GridPad = Pad & { gridIndex: number };

let audioModeConfigured = false;

async function ensureAudioModeConfigured() {
  if (audioModeConfigured) {
    return;
  }

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
    });
    audioModeConfigured = true;
  } catch (error) {
    console.warn('Failed to configure audio mode', error);
  }
}

function createPlaceholderPad(id: number): Pad {
  return {
    id,
    sounds: [],
    isActive: false,
    currentSoundIndex: 0,
  };
}

export function FragmentPlayback({ fragment }: FragmentPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [currentBeatIndex, setCurrentBeatIndex] = useState<number | null>(null);

  const assignColor = useSoundColors();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const beatIndexRef = useRef(0);
  const isMountedRef = useRef(true);
  const soundCacheRef = useRef<SoundCache>(new Map());
  const soundPromiseRef = useRef<Map<string, Promise<Audio.Sound | null>>>(new Map());
  const urlCacheRef = useRef<UrlCache>(new Map());
  const urlPromiseRef = useRef<UrlPromiseCache>(new Map());

  const rows = fragment.rows && fragment.rows > 0 ? fragment.rows : 4;
  const columns = fragment.columns && fragment.columns > 0 ? fragment.columns : 4;
  const totalCells = Math.max(1, rows * columns);

  const sortedPads = useMemo<GridPad[]>(() => {
    const pads = fragment.pads ?? [];
    const limited = pads.slice(0, totalCells);
    const padded: GridPad[] = Array.from({ length: totalCells }, (_, index) => ({
      ...createPlaceholderPad(index),
      gridIndex: index,
    }));

    limited.forEach((pad, index) => {
      padded[index] = {
        ...pad,
        sounds: pad.sounds ?? [],
        isActive: pad.isActive ?? (pad.sounds?.length ?? 0) > 0,
        currentSoundIndex: pad.currentSoundIndex ?? 0,
        gridIndex: index,
      };
    });

    return padded;
  }, [fragment.pads, totalCells]);

  const getDisplayColor = useCallback(
    (pad: Pad) => {
      const currentIndex = pad.currentSoundIndex ?? 0;
      const sound = pad.sounds?.[currentIndex] ?? pad.sounds?.[0];
      if (!sound) {
        return '#1f2937';
      }

      const normalized = normalizePadColor(sound.color);
      if (normalized) {
        return normalized;
      }

      return assignColor(sound.soundId);
    },
    [assignColor]
  );

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    clearIntervalRef();
    beatIndexRef.current = 0;
    if (isMountedRef.current) {
      setIsPlaying(false);
      setCurrentBeatIndex(null);
      setIsPreparing(false);
    }
    soundCacheRef.current.forEach((sound) => {
      void sound.getStatusAsync().then((status) => {
        if (!status.isLoaded) {
          return;
        }
        return sound.stopAsync().catch((error) => {
          console.warn('Failed to stop sound', error);
        });
      });
    });
  }, [clearIntervalRef]);

  const unloadSounds = useCallback(async () => {
    const unloadPromises = Array.from(soundCacheRef.current.values()).map(async (sound) => {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.warn('Failed to unload sound', error);
      }
    });
    await Promise.all(unloadPromises);
    soundCacheRef.current.clear();
    soundPromiseRef.current.clear();
  }, []);

  const getPlayableUrl = useCallback(
    async (padSound: PadSound): Promise<string | null> => {
      const candidates = [padSound.downloadUrl, padSound.soundUrl].filter((candidate): candidate is string => Boolean(candidate));
      if (candidates.length === 0 && padSound.soundId) {
        candidates.push(padSound.soundId);
      }

      for (const candidate of candidates) {
        const cacheKey = candidate;
        if (urlCacheRef.current.has(cacheKey)) {
          return urlCacheRef.current.get(cacheKey)!;
        }

        if (urlPromiseRef.current.has(cacheKey)) {
          const resolved = await urlPromiseRef.current.get(cacheKey)!;
          if (resolved) {
            return resolved;
          }
          continue;
        }

        let resolver: Promise<string | null>;
        if (candidate.startsWith('http')) {
          resolver = Promise.resolve(candidate);
        } else if (candidate.startsWith('gs://')) {
          resolver = getDownloadURL(ref(storage, candidate)).catch((error) => {
            console.warn('Failed to resolve Firebase storage URL', error);
            return null;
          });
        } else {
          // Not a supported URL format
          continue;
        }

        urlPromiseRef.current.set(cacheKey, resolver);
        const resolved = await resolver;
        urlPromiseRef.current.delete(cacheKey);
        if (resolved) {
          urlCacheRef.current.set(cacheKey, resolved);
          return resolved;
        }
      }

      return null;
    },
    []
  );

  const loadSoundFromSource = useCallback(
    async (
      cacheKey: string,
      source: Parameters<typeof Audio.Sound.createAsync>[0]
    ): Promise<Audio.Sound | null> => {
      if (soundCacheRef.current.has(cacheKey)) {
        return soundCacheRef.current.get(cacheKey)!;
      }

      if (soundPromiseRef.current.has(cacheKey)) {
        return soundPromiseRef.current.get(cacheKey)!;
      }

      const promise = (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false, volume: 1 });
          soundCacheRef.current.set(cacheKey, sound);
          return sound;
        } catch (error) {
          console.warn('Failed to load sound', error);
          return null;
        }
      })();

      soundPromiseRef.current.set(cacheKey, promise);
      const loadedSound = await promise;
      soundPromiseRef.current.delete(cacheKey);
      if (!loadedSound) {
        soundCacheRef.current.delete(cacheKey);
      }
      return loadedSound;
    },
    []
  );

  const loadSoundForPadSound = useCallback(
    async (padSound: PadSound): Promise<Audio.Sound | null> => {
      if (padSound.asset) {
        const cacheKey = `asset:${padSound.asset}`;
        return loadSoundFromSource(cacheKey, padSound.asset);
      }

      if (padSound.localUri) {
        const cacheKey = `file:${padSound.localUri}`;
        return loadSoundFromSource(cacheKey, { uri: padSound.localUri });
      }

      const url = await getPlayableUrl(padSound);
      if (!url) {
        return null;
      }

      return loadSoundFromSource(url, { uri: url });
    },
    [getPlayableUrl, loadSoundFromSource]
  );

  const playPadSounds = useCallback(
    async (pad: Pad) => {
      if (!pad.sounds || pad.sounds.length === 0) {
        return;
      }

      const playPromises = pad.sounds.map(async (padSound) => {
        const sound = await loadSoundForPadSound(padSound);
        if (!sound) {
          return;
        }
        try {
          const status = await sound.getStatusAsync();
          if (!status.isLoaded) {
            return;
          }
          if (status.isPlaying) {
            await sound.stopAsync();
          }
          await sound.playFromPositionAsync(0);
        } catch (error) {
          console.warn('Failed to play sound', error);
        }
      });

      await Promise.all(playPromises);
    },
    [loadSoundForPadSound]
  );

  const startPlayback = useCallback(async () => {
    if (isPlaying || isPreparing || sortedPads.length === 0) {
      return;
    }

    setIsPreparing(true);
    try {
      await ensureAudioModeConfigured();

      if (isMountedRef.current) {
        setCurrentBeatIndex(0);
      }

      const firstPad = sortedPads[0];
      if (firstPad) {
        await playPadSounds(firstPad);
      }

      if (!isMountedRef.current) {
        return;
      }

      setIsPlaying(true);
      beatIndexRef.current = 0;

      const intervalMs = Math.max(1, Math.round(60000 / Math.max(fragment.bpm ?? 120, 1)));

      clearIntervalRef();
      intervalRef.current = setInterval(() => {
        beatIndexRef.current = (beatIndexRef.current + 1) % sortedPads.length;
        const nextPad = sortedPads[beatIndexRef.current];
        if (!nextPad) {
          return;
        }
        if (isMountedRef.current) {
          setCurrentBeatIndex(nextPad.gridIndex);
        }
        void playPadSounds(nextPad);
      }, intervalMs);
    } finally {
      if (isMountedRef.current) {
        setIsPreparing(false);
      }
    }
  }, [clearIntervalRef, fragment.bpm, isPlaying, isPreparing, playPadSounds, sortedPads]);

  const togglePlayback = useCallback(() => {
    if (isPreparing) {
      return;
    }

    if (isPlaying) {
      stopPlayback();
    } else {
      void startPlayback();
    }
  }, [isPlaying, isPreparing, startPlayback, stopPlayback]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearIntervalRef();
      void unloadSounds();
    };
  }, [clearIntervalRef, unloadSounds]);

  useEffect(() => {
    stopPlayback();
  }, [fragment.columns, fragment.id, fragment.pads, fragment.rows, stopPlayback]);

  useEffect(() => {
    sortedPads.forEach((pad) => {
      pad.sounds?.forEach((padSound) => {
        void loadSoundForPadSound(padSound);
      });
    });
  }, [loadSoundForPadSound, sortedPads]);

  const cellWidth = `${100 / columns}%`;

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause fragment playback' : 'Play fragment playback'}
          style={[
            styles.controlButton,
            isPlaying ? styles.controlButtonActive : null,
            isPreparing ? styles.controlButtonDisabled : null,
          ]}
          onPress={togglePlayback}
          disabled={isPreparing}
        >
          {isPreparing ? (
            <ActivityIndicator size="small" color="#f8fafc" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#f8fafc" />
          )}
        </Pressable>
      </View>
      <View style={[styles.grid, { aspectRatio: columns / rows }]}>
        {sortedPads.map((pad) => {
          const color = getDisplayColor(pad);
          const isActiveBeat = isPlaying && currentBeatIndex === pad.gridIndex;
          const hasMultipleSounds = (pad.sounds?.length ?? 0) > 1;
          const hasSounds = (pad.sounds?.length ?? 0) > 0;

          return (
            <View
              key={pad.gridIndex}
              style={[
                styles.cell,
                { width: cellWidth, backgroundColor: hasSounds ? color : '#15213a' },
                isActiveBeat ? styles.activeCell : null,
              ]}
            >
              {hasMultipleSounds ? (
                <View style={styles.layersBadge}>
                  <Ionicons name="layers" size={12} color="#e2e8f0" />
                </View>
              ) : null}
              {isActiveBeat ? <View style={styles.activeOverlay} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020617',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  controlButtonActive: {
    backgroundColor: '#0ea5e9',
  },
  controlButtonDisabled: {
    opacity: 0.7,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cell: {
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCell: {
    shadowColor: '#38bdf8',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  layersBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 8,
    padding: 2,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#38bdf8',
    pointerEvents: 'none',
  },
});
