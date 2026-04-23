import { StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { palette } from "@/lib/theme";

export default function BillingScreen() {
  return (
    <ScreenFrame
      eyebrow="Billing"
      title="The paywall should feel clear before it feels persuasive."
      description="Mobile billing keeps the trial state visible and explains what changes when the subscription becomes active or lapses."
    >
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Current launch offer</Text>
        <Text style={styles.panelValue}>14-day trial | $24 / month after trial</Text>
        <Text style={styles.panelCopy}>QuickBooks sync, Excel row appends, exports, and support access are all part of the owner-operator plan.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>If the trial expires</Text>
        <Text style={styles.panelCopy}>New syncs lock, the audit trail stays readable, and the user is routed to restore billing with RevenueCat-managed entitlements.</Text>
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
  panelValue: {
    color: palette.accent,
    fontSize: 17,
    fontWeight: "700",
  },
  panelCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
