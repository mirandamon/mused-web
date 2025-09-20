import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Pad } from '@/lib/types';

export interface FragmentEditorProps {
  initialPads?: Pad[];
  initialBpm?: number;
  initialTitle?: string;
  originalFragmentId?: string | null;
  originalAuthorName?: string | null;
  onPostStart?: () => void;
  onPostSuccess?: (result: unknown) => void;
  onPostError?: (error: Error) => void;
}

const GRID_COLUMNS = 4;
const DEFAULT_PAD_COUNT = GRID_COLUMNS * GRID_COLUMNS;

const createDefaultPads = (): Pad[] =>
  Array.from({ length: DEFAULT_PAD_COUNT }, (_, index) => ({
    id: index,
    sounds: [],
    isActive: false,
    currentSoundIndex: 0,
  }));

const getApiUrl = () =>
  process.env.EXPO_PUBLIC_MUSED_API_URL ?? process.env.NEXT_PUBLIC_MUSED_API_URL;

const FragmentEditor: React.FC<FragmentEditorProps> = ({
  initialPads,
  initialBpm = 120,
  initialTitle = '',
  originalFragmentId = null,
  originalAuthorName = null,
  onPostStart,
  onPostSuccess,
  onPostError,
}) => {
  const [pads, setPads] = useState<Pad[]>(initialPads ?? createDefaultPads());
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [title, setTitle] = useState<string>(initialTitle);
  const [isPosting, setIsPosting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialPads) {
      setPads(initialPads);
    }
  }, [initialPads]);

  useEffect(() => {
    setBpm(initialBpm);
  }, [initialBpm]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const hasAnySound = useMemo(
    () => pads.some((pad) => pad.sounds && pad.sounds.length > 0),
    [pads],
  );

  const handleBpmChange = useCallback((value: string) => {
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      setBpm(0);
      return;
    }
    setBpm(Math.min(Math.max(numeric, 20), 240));
  }, []);

  const postFragment = useCallback(async () => {
    if (isPosting) return;

    if (!hasAnySound) {
      const message = 'Add at least one sound to a pad before posting.';
      setStatusMessage(message);
      Alert.alert('Fragment incomplete', message);
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      const error = new Error('API URL is not configured. Set EXPO_PUBLIC_MUSED_API_URL in your app config.');
      setStatusMessage(error.message);
      onPostError?.(error);
      Alert.alert('Missing configuration', error.message);
      return;
    }

    onPostStart?.();
    setIsPosting(true);
    setStatusMessage('Posting fragment...');

    const padsPayload = pads
      .filter((pad) => pad.sounds && pad.sounds.length > 0)
      .map((pad) => ({
        id: pad.id,
        isActive: pad.isActive,
        currentSoundIndex: pad.currentSoundIndex ?? 0,
        sounds: pad.sounds.map((sound) => ({
          soundId: sound.soundId,
          soundName: sound.soundName,
          soundUrl: sound.soundUrl,
        })),
      }));

    const body = {
      pads: padsPayload,
      bpm,
      title: title?.trim() || 'Untitled Fragment',
      originalFragmentId: originalFragmentId ?? null,
      columns: GRID_COLUMNS,
      rows: GRID_COLUMNS,
    };

    try {
      const response = await fetch(`${apiUrl}/fragments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          (errorPayload && (errorPayload.details || errorPayload.error)) ||
          `Failed to post fragment (status ${response.status}).`;
        throw new Error(errorMessage);
      }

      const result = await response.json().catch(() => null);

      const successText = originalFragmentId
        ? `Remix submitted! ${originalAuthorName ? `We'll let ${originalAuthorName} know.` : ''}`.trim()
        : 'Fragment posted!';
      setStatusMessage(successText);
      Alert.alert('Success', successText);
      onPostSuccess?.(result);
    } catch (error) {
      const normalisedError = error instanceof Error ? error : new Error('Could not post the fragment.');
      setStatusMessage(normalisedError.message);
      Alert.alert('Post failed', normalisedError.message);
      onPostError?.(normalisedError);
    } finally {
      setIsPosting(false);
    }
  }, [
    bpm,
    hasAnySound,
    isPosting,
    onPostError,
    onPostStart,
    onPostSuccess,
    originalAuthorName,
    originalFragmentId,
    pads,
    title,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.heading}>Fragment details</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            accessibilityLabel="Fragment title"
            autoCapitalize="sentences"
            onChangeText={setTitle}
            placeholder="Name your fragment"
            style={styles.input}
            value={title}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>BPM</Text>
          <TextInput
            accessibilityLabel="Fragment tempo"
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={handleBpmChange}
            placeholder="120"
            style={styles.input}
            value={bpm ? String(bpm) : ''}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Pads overview</Text>
        <View style={styles.padGrid}>
          {pads.map((pad) => {
            const isFilled = pad.sounds.length > 0;
            return (
              <View
                key={pad.id}
                style={[styles.pad, isFilled ? styles.padFilled : styles.padEmpty]}
                accessibilityLabel={`Pad ${pad.id + 1}, ${pad.sounds.length} sounds`}
              >
                <Text style={[styles.padTitle, isFilled ? styles.padTextOnFilled : null]}>
                  Pad {pad.id + 1}
                </Text>
                <Text style={[styles.padSubtitle, isFilled ? styles.padMutedOnFilled : null]}>
                  {pad.sounds.length} sound{pad.sounds.length === 1 ? '' : 's'}
                </Text>
                <Text style={[styles.padStatus, isFilled ? styles.padMutedOnFilled : null]}>
                  {pad.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

      <TouchableOpacity
        accessibilityRole="button"
        disabled={isPosting}
        onPress={postFragment}
        style={[styles.submitButton, isPosting ? styles.submitButtonDisabled : null]}
      >
        {isPosting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitLabel}>Post fragment</Text>}
      </TouchableOpacity>
      <Text style={styles.helperText}>Make sure at least one pad contains a sound before posting.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingBottom: 32,
  },
  section: {
    gap: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  input: {
    borderColor: '#d0d0d0',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  padGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pad: {
    alignItems: 'flex-start',
    borderRadius: 16,
    flexBasis: '47%',
    gap: 4,
    padding: 16,
  },
  padFilled: {
    backgroundColor: '#111827',
  },
  padEmpty: {
    backgroundColor: '#f3f4f6',
  },
  padTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  padSubtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  padStatus: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  padTextOnFilled: {
    color: '#f9fafb',
  },
  padMutedOnFilled: {
    color: '#d1d5db',
  },
  statusMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default FragmentEditor;
