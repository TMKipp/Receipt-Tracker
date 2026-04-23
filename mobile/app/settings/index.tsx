import { StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { palette } from "@/lib/theme";

export default function SettingsScreen() {
  return (
    <ScreenFrame
      eyebrow="Account"
      title="Commercial defaults stay visible here."
      description="This is where onboarding completion, auto-approve, and integration status become explicit instead of implied."
    >
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Account defaults</Text>
        <Text style={styles.panelCopy}>Country: United States</Text>
        <Text style={styles.panelCopy}>Currency: USD</Text>
        <Text style={styles.panelCopy}>Auto-approve: Off until the owner opts in after onboarding.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Connection health</Text>
        <Text style={styles.panelCopy}>QuickBooks: Connected</Text>
        <Text style={styles.panelCopy}>Microsoft: Connected</Text>
        <Text style={styles.panelCopy}>Excel workbook: Expenses_2026 pinned</Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
    gap: 10,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  panelCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
