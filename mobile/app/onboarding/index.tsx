import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { metrics } from "@/lib/mock-data";
import { palette } from "@/lib/theme";

export default function OnboardingScreen() {
  return (
    <ScreenFrame
      eyebrow="Onboarding"
      title="Connect the books before capture becomes muscle memory."
      description="The fastest launch path is deliberate: sign in, connect QuickBooks, pin the Excel workbook, then capture the first receipt."
    >
      <View style={styles.metricRow}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>First-session checklist</Text>
        <Text style={styles.panelCopy}>1. Sign in with Supabase-backed auth.</Text>
        <Text style={styles.panelCopy}>2. Connect QuickBooks and import accounts.</Text>
        <Text style={styles.panelCopy}>3. Pin the Excel workbook table for exports and live rows.</Text>
        <Text style={styles.panelCopy}>4. Capture one receipt and approve the first sync.</Text>
      </View>

      <Link href="/(tabs)" asChild>
        <Pressable style={styles.primaryAction}>
          <Text style={styles.primaryText}>Enter the workspace</Text>
        </Pressable>
      </Link>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 13,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "700",
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    gap: 10,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  panelCopy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  primaryAction: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: {
    color: "#f6f3eb",
    fontSize: 16,
    fontWeight: "700",
  },
});
