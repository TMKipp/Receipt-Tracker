import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { StatusPill } from "@/components/status-pill";
import { palette } from "@/lib/theme";

export default function SettingsTabScreen() {
  return (
    <ScreenFrame
      eyebrow="Account"
      title="Keep access, trust, and sync health in one place."
      description="The owner should be able to check billing, integrations, and launch readiness without leaving the mobile workspace."
    >
      <View style={styles.accountHero}>
        <View style={styles.accountCopy}>
          <Text style={styles.accountLabel}>Primary workspace</Text>
          <Text style={styles.accountName}>Atlas Property Services</Text>
          <Text style={styles.accountMeta}>terry@atlasps.com</Text>
        </View>
        <StatusPill label="trial active" tone="accent" />
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="quickbooks connected" tone="accent" />
        <StatusPill label="excel pinned" tone="neutral" />
        <StatusPill label="support ready" tone="warm" />
      </View>

      <Link href="/settings" asChild>
        <Pressable style={styles.panel}>
          <Text style={styles.panelTitle}>Integration and sync health</Text>
          <Text style={styles.panelCopy}>Review onboarding progress, workbook setup, and whether the next receipt is ready to post.</Text>
        </Pressable>
      </Link>

      <Link href="/billing" asChild>
        <Pressable style={styles.panel}>
          <Text style={styles.panelTitle}>Plan and access recovery</Text>
          <Text style={styles.panelCopy}>Check trial timing, entitlement state, and the restore-access path before launch.</Text>
        </Pressable>
      </Link>

      <Link href="/onboarding" asChild>
        <Pressable style={styles.panel}>
          <Text style={styles.panelTitle}>Launch checklist</Text>
          <Text style={styles.panelCopy}>Walk back through setup milestones and make sure first value still happens inside five minutes.</Text>
        </Pressable>
      </Link>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  accountHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  accountCopy: {
    flex: 1,
    gap: 6,
  },
  accountLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  accountName: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  accountMeta: {
    color: palette.muted,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  panel: {
    gap: 8,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  panelCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
