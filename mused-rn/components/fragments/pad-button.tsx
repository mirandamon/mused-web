import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Pad } from '@/lib/types';

interface PadButtonProps {
  pad: Pad;
  onPress: () => void;
  onLongPress?: () => void;
  isSelected: boolean;
  isCurrent: boolean;
}

function PadButtonComponent({ pad, onPress, onLongPress, isSelected, isCurrent }: PadButtonProps) {
  const backgroundColor = useMemo(() => {
    if (pad.sounds.length === 0) {
      return '#1f2937';
    }
    return pad.sounds[0].color ?? '#2563eb';
  }, [pad.sounds]);

  const borderColor = isCurrent ? '#facc15' : isSelected ? '#e5e7eb' : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.pad,
        {
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.padLabel}>{pad.id + 1}</Text>
        {pad.sounds.length > 0 ? (
          <Text style={styles.soundCount}>{pad.sounds.length}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const PadButton = memo(PadButtonComponent);

const styles = StyleSheet.create({
  pad: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
  },
  padLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  soundCount: {
    color: '#f1f5f9',
    fontSize: 12,
    marginTop: 4,
  },
});
