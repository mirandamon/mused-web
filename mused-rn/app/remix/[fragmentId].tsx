import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FragmentEditor } from '@/components/fragments/fragment-editor';
import { useFragment } from '@/hooks/use-fragments';

export default function RemixScreen() {
  const { fragmentId } = useLocalSearchParams<{ fragmentId?: string }>();
  const { data, isLoading, error } = useFragment(fragmentId);

  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Unable to load fragment</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Remix {data.author}&apos;s fragment</Text>
          <Text style={styles.subtitle}>Start with their grid and make it your own.</Text>
          <FragmentEditor initialPads={data.pads} bpm={data.bpm ?? 120} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorBody: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
