import React, { useCallback, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import FragmentEditor from '@/components/fragments/fragment-editor';

export default function CreateFragmentScreen() {
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePostStart = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPosting(true);
  }, []);

  const handlePostSuccess = useCallback(() => {
    setIsPosting(false);
    setSuccessMessage('Fragment posted successfully!');
  }, []);

  const handlePostError = useCallback((error: Error) => {
    setIsPosting(false);
    setErrorMessage(error.message);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Create a fragment</Text>
        <Text style={styles.pageSubtitle}>
          Build your beat, add a title, and share it with the Mused community.
        </Text>

        <FragmentEditor
          onPostStart={handlePostStart}
          onPostSuccess={handlePostSuccess}
          onPostError={handlePostError}
        />

        {isPosting ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color="#111827" size="small" />
            <Text style={styles.statusLabel}>Publishing your fragment…</Text>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
