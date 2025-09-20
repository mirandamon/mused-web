import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { MiniPadGrid } from '@/components/feed/mini-pad-grid';
import type { Fragment } from '@/lib/types';

interface FragmentCardProps {
  fragment: Fragment;
}

export function FragmentCard({ fragment }: FragmentCardProps) {
  const router = useRouter();

  const timestamp = useMemo(() => {
    if (!fragment.timestamp) {
      return '';
    }
    try {
      const date = fragment.timestamp instanceof Date ? fragment.timestamp : new Date(fragment.timestamp);
      return date.toLocaleString();
    } catch {
      return String(fragment.timestamp);
    }
  }, [fragment.timestamp]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.author}>{fragment.author}</Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
        {fragment.bpm ? <Text style={styles.bpm}>{fragment.bpm} BPM</Text> : null}
      </View>

      <View style={styles.gridContainer}>
        <MiniPadGrid pads={fragment.pads} />
      </View>

      <View style={styles.footer}>
        <View style={styles.stats}>
          <Text style={styles.statLabel}>❤ {fragment.likes}</Text>
          <Text style={styles.statLabel}>💬 {fragment.commentsCount ?? fragment.comments.length}</Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/remix/[fragmentId]', params: { fragmentId: fragment.id } })}
          style={styles.remixButton}
        >
          <Text style={styles.remixLabel}>Remix</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  timestamp: {
    color: '#94a3b8',
    marginTop: 4,
  },
  bpm: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  gridContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stats: {
    flexDirection: 'row',
  },
  statLabel: {
    color: '#cbd5f5',
    fontWeight: '600',
    marginRight: 12,
  },
  remixButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  remixLabel: {
    color: '#f8fafc',
    fontWeight: '700',
  },
});
