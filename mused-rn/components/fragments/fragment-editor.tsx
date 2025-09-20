import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PadGrid } from '@/components/fragments/pad-grid';
import { SoundPicker } from '@/components/fragments/sound-picker';
import { useSoundColors } from '@/hooks/use-sound-colors';
import { useSoundLibrary } from '@/hooks/use-sound-library';
import { createEmptyPads, GRID_SIZE } from '@/lib/pads';
import type { Pad, PadSound, Sound } from '@/lib/types';

interface FragmentEditorProps {
  initialPads?: Pad[];
  bpm?: number;
}

const MIN_BPM = 60;
const MAX_BPM = 180;

export function FragmentEditor({ initialPads, bpm: initialBpm = 120 }: FragmentEditorProps) {
  const assignColor = useSoundColors();
  const [pads, setPads] = useState<Pad[]>(() => {
    if (initialPads && initialPads.length === GRID_SIZE) {
      return initialPads.map((pad) => ({
        ...pad,
        sounds: pad.sounds.map((sound) => ({
          ...sound,
          color: sound.color ?? assignColor(sound.soundId),
        })),
      }));
    }
    return createEmptyPads();
  });
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [isSoundPickerVisible, setIsSoundPickerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [bpm, setBpm] = useState(initialBpm);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef(0);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const { sounds, isLoading: isLoadingSounds, error: soundsError } = useSoundLibrary();

  const padsRef = useRef(pads);

  useEffect(() => {
    padsRef.current = pads;
  }, [pads]);

  const selectedPad = useMemo(
    () => (selectedPadId !== null ? pads[selectedPadId] : null),
    [selectedPadId, pads]
  );

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  const playPadSounds = useCallback(
    async (pad: Pad) => {
      if (isMuted) return;
      await Promise.all(
        pad.sounds.map(async (padSound) => {
          try {
            const source = padSound.asset
              ? padSound.asset
              : padSound.localUri
                ? { uri: padSound.localUri }
                : padSound.downloadUrl
                  ? { uri: padSound.downloadUrl }
                  : padSound.soundUrl
                    ? { uri: padSound.soundUrl }
                    : undefined;

            if (!source) {
              return;
            }

            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            sound.setOnPlaybackStatusUpdate((status) => {
              if (!status.isLoaded || !status.didJustFinish) {
                return;
              }
              sound.unloadAsync().catch(() => undefined);
            });
          } catch (error) {
            console.warn('Failed to play sound', error);
          }
        })
      );
    },
    [isMuted]
  );

  const stopPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(null);
  }, []);

  const startPlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const currentPads = padsRef.current;
    if (!currentPads.length) {
      return;
    }

    setIsPlaying(true);
    currentStepRef.current = 0;
    setCurrentStep(currentPads[0].id);
    playPadSounds(currentPads[0]).catch(() => undefined);

    const stepDurationMs = (60_000 / bpm) / 4;
    playbackTimerRef.current = setInterval(() => {
      const padsSnapshot = padsRef.current;
      currentStepRef.current = (currentStepRef.current + 1) % padsSnapshot.length;
      const nextPad = padsSnapshot[currentStepRef.current];
      setCurrentStep(nextPad.id);
      playPadSounds(nextPad).catch(() => undefined);
    }, stepDurationMs);
  }, [bpm, isPlaying, playPadSounds, stopPlayback]);

  const updatePad = useCallback((padId: number, updater: (pad: Pad) => Pad) => {
    setPads((prevPads) => prevPads.map((pad) => (pad.id === padId ? updater(pad) : pad)));
  }, []);

  const toggleSoundOnPad = useCallback(
    (sound: Sound) => {
      if (selectedPadId === null) {
        Alert.alert('Select a pad first', 'Tap a pad to assign sounds.');
        return;
      }

      updatePad(selectedPadId, (pad) => {
        const existingIndex = pad.sounds.findIndex((padSound) => padSound.soundId === sound.id);
        if (existingIndex >= 0) {
          const nextSounds = pad.sounds.filter((padSound) => padSound.soundId !== sound.id);
          return { ...pad, sounds: nextSounds, isActive: nextSounds.length > 0 };
        }

        const nextSound: PadSound = {
          soundId: sound.id,
          soundName: sound.name,
          source: sound.type,
          downloadUrl: sound.downloadUrl ?? sound.previewUrl,
          soundUrl: sound.source_url,
          color: assignColor(sound.id),
          asset: sound.asset,
        };

        return {
          ...pad,
          sounds: [...pad.sounds, nextSound],
          isActive: true,
        };
      });
    },
    [assignColor, selectedPadId, updatePad]
  );

  const clearPad = useCallback(
    (padId: number) => {
      updatePad(padId, (pad) => ({ ...pad, sounds: [], isActive: false }));
    },
    [updatePad]
  );

  const handlePadPress = useCallback(
    (padId: number) => {
      setSelectedPadId(padId);
      setIsSoundPickerVisible(true);
    },
    []
  );

  const handleLongPress = useCallback(
    (padId: number) => {
      Alert.alert('Remove sounds?', 'Clear all sounds from this pad?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => clearPad(padId) },
      ]);
    },
    [clearPad]
  );

  const ensureRecordingPermissions = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record audio.');
      return false;
    }
    return true;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      return;
    }
    if (selectedPadId === null) {
      Alert.alert('Select a pad', 'Choose a pad before recording.');
      return;
    }
    const granted = await ensureRecordingPermissions();
    if (!granted) {
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.warn('Failed to start recording', error);
      Alert.alert('Recording error', 'Could not start recording.');
    }
  }, [ensureRecordingPermissions, isRecording, selectedPadId]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) {
      return;
    }
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri || selectedPadId === null) {
        return;
      }

      const soundId = `recording-${Date.now()}`;
      updatePad(selectedPadId, (pad) => ({
        ...pad,
        sounds: [
          ...pad.sounds,
          {
            soundId,
            soundName: 'Live Recording',
            source: 'live',
            color: assignColor(soundId),
            localUri: uri,
          },
        ],
        isActive: true,
      }));
    } catch (error) {
      console.warn('Failed to finish recording', error);
      Alert.alert('Recording error', 'Could not save the recording.');
    }
  }, [assignColor, selectedPadId, updatePad]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording().catch(() => undefined);
    } else {
      startRecording().catch(() => undefined);
    }
  }, [isRecording, startRecording, stopRecording]);

  const decrementBpm = useCallback(() => {
    setBpm((current) => Math.max(MIN_BPM, current - 5));
  }, []);

  const incrementBpm = useCallback(() => {
    setBpm((current) => Math.min(MAX_BPM, current + 5));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={startPlayback}
          style={[styles.controlButton, isPlaying && styles.controlButtonActive]}
        >
          <Text style={styles.controlLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable
          onPress={toggleRecording}
          style={[styles.controlButton, isRecording && styles.recordingButton]}
        >
          <Text style={styles.controlLabel}>{isRecording ? 'Stop' : 'Record'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setIsMuted((prev) => !prev)}
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
        >
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
      </View>

      <View style={styles.bpmRow}>
        <Pressable onPress={decrementBpm} style={styles.bpmButton}>
          <Text style={styles.bpmLabel}>-</Text>
        </Pressable>
        <Text style={styles.bpmValue}>{bpm} BPM</Text>
        <Pressable onPress={incrementBpm} style={styles.bpmButton}>
          <Text style={styles.bpmLabel}>+</Text>
        </Pressable>
      </View>

      <PadGrid
        pads={pads}
        onPressPad={handlePadPress}
        onLongPressPad={handleLongPress}
        selectedPadId={selectedPadId}
        currentStep={currentStep}
      />

      {selectedPad ? (
        <View style={styles.padDetails}>
          <Text style={styles.sectionTitle}>Pad {selectedPad.id + 1}</Text>
          {selectedPad.sounds.length === 0 ? (
            <Text style={styles.emptyState}>No sounds yet. Add from the library or record one.</Text>
          ) : (
            selectedPad.sounds.map((sound) => (
              <View key={sound.soundId} style={styles.padSoundRow}>
                <View style={[styles.colorSwatch, { backgroundColor: sound.color ?? '#38bdf8' }]} />
                <View style={styles.padSoundInfo}>
                  <Text style={styles.padSoundName}>{sound.soundName}</Text>
                  <Text style={styles.padSoundMeta}>{sound.source ?? 'custom'}</Text>
                </View>
                <Pressable
                  onPress={() => toggleSoundOnPad({
                    id: sound.soundId,
                    name: sound.soundName,
                    type: sound.source ?? 'uploaded',
                    downloadUrl: sound.downloadUrl,
                    source_url: sound.soundUrl,
                    asset: sound.asset,
                  })}
                >
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}

      <SoundPicker
        visible={isSoundPickerVisible}
        onClose={() => setIsSoundPickerVisible(false)}
        onToggleSound={toggleSoundOnPad}
        currentPadSounds={selectedPad?.sounds ?? []}
        sounds={sounds}
        isLoading={isLoadingSounds}
        error={soundsError as Error | undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginHorizontal: 8,
  },
  controlButtonActive: {
    backgroundColor: '#2563eb',
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  controlLabel: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpmButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  bpmLabel: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '600',
  },
  bpmValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  padDetails: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyState: {
    color: '#94a3b8',
  },
  padSoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  padSoundInfo: {
    flex: 1,
  },
  padSoundName: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  padSoundMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  removeLabel: {
    color: '#f87171',
    fontWeight: '600',
  },
});
