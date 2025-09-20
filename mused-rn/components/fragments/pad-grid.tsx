import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Pad } from '@/lib/types';

import { PadButton } from './pad-button';

interface PadGridProps {
  pads: Pad[];
  onPressPad: (padId: number) => void;
  onLongPressPad?: (padId: number) => void;
  selectedPadId: number | null;
  currentStep: number | null;
}

function PadGridComponent({ pads, onPressPad, onLongPressPad, selectedPadId, currentStep }: PadGridProps) {
  return (
    <View style={styles.container}>
      {pads.map((pad) => (
        <View key={pad.id} style={styles.cell}>
          <PadButton
            pad={pad}
            onPress={() => onPressPad(pad.id)}
            onLongPress={onLongPressPad ? () => onLongPressPad(pad.id) : undefined}
            isSelected={selectedPadId === pad.id}
            isCurrent={currentStep === pad.id}
          />
        </View>
      ))}
    </View>
  );
}

export const PadGrid = memo(PadGridComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    columnGap: 16,
    justifyContent: 'center',
  },
  cell: {
    width: '22%',
    minWidth: 72,
  },
});
