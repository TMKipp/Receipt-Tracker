import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { StatusPill } from "@/components/status-pill";
import { metrics, receipts } from "@/lib/mock-data";
import { palette } from "@/lib/theme";

function receiptTone(status: string): "accent" | "warm" | "neutral" | "danger" {
  switch (status) {
    case "review_required":
      return "warm";
    case "synced":
      return "neutral";
    case "approved":
      return "accent";
    default:
      return "neutral";
  }
}

export default function InboxScreen() {
  const selectedReceipt = receipts[0];

  return (
    <ScreenFrame
      eyebrow="Inbox"
      title="Keep the queue readable when the day gets busy."
      description="Trust checks stay close to the selected receipt so an owner can approve the next sync without hunting for context."
    >
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>Selected for review</Text>
            <Text style={styles.heroVendor}>{selectedReceipt.vendor}</Text>
            <Text style={styles.heroMeta}>
              {selectedReceipt.category} | {selectedReceipt.date} | {Math.round(selectedReceipt.confidence * 100)}% confidence
            </Text>
          </View>
          <Text style={styles.heroTotal}>{selectedReceipt.total}</Text>
        </View>

        <StatusPill label={selectedReceipt.status.replace("_", " ")} tone={receiptTone(selectedReceipt.status)} />
        <Text style={styles.heroNote}>{selectedReceipt.notes}</Text>

        <View style={styles.trustStrip}>
          {selectedReceipt.decisionSummary.slice(0, 2).map((item) => (
            <View key={item} style={styles.trustRow}>
              <View style={styles.trustMarker} />
              <Text style={styles.trustCopy}>{item}</Text>
            </View>
          ))}
        </View>

        <Link href={`/receipts/${selectedReceipt.id}`} asChild>
          <Pressable style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Open review</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.metricBand}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCell}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Inbox queue</Text>
        <Text style={styles.sectionMeta}>{receipts.length} active</Text>
      </View>

      <View style={styles.receiptList}>
        {receipts.map((receipt, index) => (
          <Link key={receipt.id} href={`/receipts/${receipt.id}`} asChild>
            <Pressable style={[styles.receiptRow, index === 0 && styles.receiptRowSelected]}>
              <View style={styles.receiptTop}>
                <View style={styles.receiptContent}>
                  <Text style={styles.receiptVendor}>{receipt.vendor}</Text>
                  <Text style={styles.receiptMeta}>
                    {receipt.category} | {receipt.date}
                  </Text>
                </View>
                <Text style={styles.receiptTotal}>{receipt.total}</Text>
              </View>

              <View style={styles.receiptFooter}>
                <StatusPill label={receipt.status.replace("_", " ")} tone={receiptTone(receipt.status)} />
                <Text style={styles.receiptNote} numberOfLines={2}>
                  {receipt.notes}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  heroContent: {
    flex: 1,
    gap: 6,
  },
  heroLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroVendor: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroTotal: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroNote: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  trustStrip: {
    gap: 10,
    paddingTop: 2,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  trustMarker: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  trustCopy: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: palette.ink,
  },
  primaryActionText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  metricBand: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCell: {
    minWidth: "30%",
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.surfaceSoft,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  metricLabel: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 13,
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
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  receiptList: {
    gap: 14,
  },
  receiptRow: {
    gap: 14,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  receiptRowSelected: {
    marginTop: -2,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.backgroundDeep,
  },
  receiptTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  receiptContent: {
    flex: 1,
    gap: 4,
  },
  receiptVendor: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  receiptMeta: {
    color: palette.muted,
    fontSize: 14,
  },
  receiptTotal: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  receiptFooter: {
    gap: 10,
  },
  receiptNote: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
