import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pad } from '@/lib/types';

interface MiniPadGridProps {
  pads: Pad[];
}

function MiniPadGridComponent({ pads }: MiniPadGridProps) {
  return (
    <View style={styles.container}>
      {pads.map((pad) => {
        const color = pad.sounds[0]?.color ?? '#1f2937';
        return <View key={pad.id} style={[styles.cell, { backgroundColor: color }]} />;
      })}
    </View>
  );
}

export const MiniPadGrid = memo(MiniPadGridComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cell: {
    width: '25%',
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#0f172a',
  },
});
