import { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PadSound, Sound } from '@/lib/types';

interface SoundPickerProps {
  visible: boolean;
  onClose: () => void;
  onToggleSound: (sound: Sound) => void;
  currentPadSounds: PadSound[];
  sounds: Sound[];
  isLoading: boolean;
  error?: Error | null;
}

function SoundPickerComponent({
  visible,
  onClose,
  onToggleSound,
  currentPadSounds,
  sounds,
  isLoading,
  error,
}: SoundPickerProps) {
  const selectedSoundIds = useMemo(() => new Set(currentPadSounds.map((sound) => sound.soundId)), [currentPadSounds]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sound Library</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close sound picker">
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : (
          <FlatList
            data={sounds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedSoundIds.has(item.id);
              return (
                <Pressable
                  onPress={() => onToggleSound(item)}
                  style={[styles.soundRow, isSelected && styles.soundRowSelected]}
                >
                  <View>
                    <Text style={styles.soundName}>{item.name}</Text>
                    <Text style={styles.soundMeta}>{item.type}</Text>
                  </View>
                  <Text style={styles.soundStatus}>{isSelected ? 'Added' : 'Add'}</Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

export const SoundPicker = memo(SoundPickerComponent);

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 48,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  closeLabel: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  soundRowSelected: {
    backgroundColor: '#1e293b',
  },
  soundName: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  soundMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  soundStatus: {
    color: '#facc15',
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1e293b',
  },
});
