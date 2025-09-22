import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import FragmentEditor from '@/components/fragments/fragment-editor';
import type { Pad } from '@/lib/types';

type RemotePad = Partial<Pad> & {
  id?: number;
  sounds?: Partial<Pad['sounds'][number]>[];
};

type RemoteFragment = {
  pads?: RemotePad[];
  bpm?: number;
  title?: string;
  author?: string;
  originalAuthor?: string;
  originalAuthorId?: string;
};

const getApiUrl = () =>
  process.env.EXPO_PUBLIC_MUSED_API_URL ?? process.env.NEXT_PUBLIC_MUSED_API_URL;

export default function RemixFragmentScreen() {
  const { fragmentId } = useLocalSearchParams<{ fragmentId?: string }>();

  const [initialPads, setInitialPads] = useState<Pad[] | null>(null);
  const [initialBpm, setInitialBpm] = useState<number>(120);
  const [initialTitle, setInitialTitle] = useState<string>('');
  const [originalAuthor, setOriginalAuthor] = useState<string | null>(null);
  const [originalAuthorId, setOriginalAuthorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!fragmentId || typeof fragmentId !== 'string') {
      setLoadError('Fragment not found.');
      setIsLoading(false);
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      setLoadError('API URL is not configured. Set EXPO_PUBLIC_MUSED_API_URL in your app config.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchFragment = async () => {
      try {
        const response = await fetch(`${apiUrl}/fragments/${fragmentId}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            (payload && (payload.error || payload.details)) ||
            `Unable to load fragment (status ${response.status}).`;
          throw new Error(message);
        }

        const data: RemoteFragment = await response.json();

        if (!isMounted) {
          return;
        }

        const padsFromApi = (data.pads ?? []).map<Pad>((pad, padIndex) => ({
          id: typeof pad.id === 'number' ? pad.id : padIndex,
          isActive:
            typeof pad.isActive === 'boolean'
              ? pad.isActive
              : (pad.sounds && pad.sounds.length ? pad.sounds.length > 0 : false),
          currentSoundIndex:
            typeof pad.currentSoundIndex === 'number' ? pad.currentSoundIndex : 0,
          sounds: (pad.sounds ?? []).map((sound, soundIndex) => ({
            soundId:
              typeof sound?.soundId === 'string'
                ? sound.soundId
                : typeof (sound as any)?.id === 'string'
                ? ((sound as any).id as string)
                : `${padIndex}-${soundIndex}`,
            soundName:
              typeof sound?.soundName === 'string'
                ? sound.soundName
                : typeof (sound as any)?.name === 'string'
                ? ((sound as any).name as string)
                : 'Untitled sound',
            soundUrl:
              typeof sound?.soundUrl === 'string'
                ? sound.soundUrl
                : typeof (sound as any)?.downloadUrl === 'string'
                ? ((sound as any).downloadUrl as string)
                : typeof (sound as any)?.source_url === 'string'
                ? ((sound as any).source_url as string)
                : undefined,
          })),
        }));

        setInitialPads(padsFromApi);
        setInitialBpm(typeof data.bpm === 'number' ? data.bpm : 120);
        setInitialTitle(data.title ? `Remix of ${data.title}` : 'Remix');
        setOriginalAuthor(data.originalAuthor ?? data.author ?? null);
        setOriginalAuthorId(
          typeof data.originalAuthorId === 'string'
            ? data.originalAuthorId
            : typeof (data as any)?.original_author_id === 'string'
            ? ((data as any).original_author_id as string)
            : null,
        );
        setLoadError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Something went wrong loading the fragment.';
        setLoadError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFragment();

    return () => {
      isMounted = false;
    };
  }, [fragmentId]);

  const handlePostStart = useCallback(() => {
    setIsPosting(true);
    setPostError(null);
    setSuccessMessage(null);
  }, []);

  const handlePostSuccess = useCallback(() => {
    setIsPosting(false);
    setSuccessMessage('Remix posted successfully!');
  }, []);

  const handlePostError = useCallback((error: Error) => {
    setIsPosting(false);
    setPostError(error.message);
  }, []);

  const screenTitle = useMemo(() => {
    if (originalAuthor) {
      return `Remix ${originalAuthor}'s fragment`;
    }
    return 'Create a remix';
  }, [originalAuthor]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>{screenTitle}</Text>
        <Text style={styles.pageSubtitle}>
          Load the original pads, tweak the arrangement, and submit your take.
        </Text>

        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color="#111827" size="large" />
            <Text style={styles.statusLabel}>Loading fragment…</Text>
          </View>
        ) : null}

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {!isLoading && !loadError ? (
          <FragmentEditor
            initialPads={initialPads ?? undefined}
            initialBpm={initialBpm}
            initialTitle={initialTitle}
            originalFragmentId={typeof fragmentId === 'string' ? fragmentId : null}
            originalAuthorName={originalAuthor}
            originalAuthorId={originalAuthorId}
            onPostStart={handlePostStart}
            onPostSuccess={handlePostSuccess}
            onPostError={handlePostError}
          />
        ) : null}

        {isPosting ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color="#111827" size="small" />
            <Text style={styles.statusLabel}>Submitting your remix…</Text>
          </View>
        ) : null}

        {postError ? <Text style={styles.errorText}>{postError}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    gap: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#6b7280',
  },
  centeredState: {
    alignItems: 'center',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#111827',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  successText: {
    color: '#047857',
    fontSize: 14,
  },
});
