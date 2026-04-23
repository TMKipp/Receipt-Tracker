import { StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { reportBuckets } from "@/lib/mock-data";
import { palette } from "@/lib/theme";

export default function ReportsScreen() {
  return (
    <ScreenFrame
      eyebrow="Reports"
      title="See what changed without leaving the workflow."
      description="The MVP report view stays tight: month totals, export readiness, and whether the books are staying current."
    >
      <View style={styles.summaryBand}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>$4,716</Text>
          <Text style={styles.summaryLabel}>April spend</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>94%</Text>
          <Text style={styles.summaryLabel}>Approved in 24h</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>CSV ready</Text>
          <Text style={styles.summaryLabel}>Export fallback</Text>
        </View>
      </View>

      <View style={styles.insightBlock}>
        <Text style={styles.insightEyebrow}>Reporting pulse</Text>
        <Text style={styles.insightTitle}>Travel and office supplies are driving the month.</Text>
        <Text style={styles.insightCopy}>
          Sync health is stable, which means the owner can review exceptions instead of rebuilding books by hand.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Monthly totals</Text>
        <Text style={styles.sectionMeta}>Ready for export</Text>
      </View>

      <View style={styles.bucketList}>
        {reportBuckets.map((bucket, index) => (
          <View key={bucket.month} style={[styles.bucketRow, index === 0 && styles.bucketRowFeatured]}>
            <View style={styles.bucketHeader}>
              <Text style={styles.bucketMonth}>{bucket.month}</Text>
              <Text style={styles.bucketAmount}>{bucket.amount}</Text>
            </View>
            <Text style={styles.bucketDelta}>{bucket.delta} versus prior month</Text>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  summaryBand: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCell: {
    minWidth: "30%",
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: palette.surfaceSoft,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  summaryValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  summaryLabel: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 13,
  },
  insightBlock: {
    gap: 10,
    padding: 22,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  insightEyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  insightTitle: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  insightCopy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bucketList: {
    gap: 14,
  },
  bucketRow: {
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  bucketRowFeatured: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.backgroundDeep,
  },
  bucketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  bucketMonth: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  bucketAmount: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  bucketDelta: {
    color: palette.muted,
    fontSize: 14,
  },
});
