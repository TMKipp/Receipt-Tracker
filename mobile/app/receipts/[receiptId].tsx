import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { StatusPill } from "@/components/status-pill";
import { receipts } from "@/lib/mock-data";
import { palette } from "@/lib/theme";

function receiptTone(status: string): "accent" | "warm" | "neutral" | "danger" {
  switch (status) {
    case "review_required":
      return "warm";
    case "approved":
      return "accent";
    case "synced":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const receipt = receipts.find((item) => item.id === receiptId) ?? receipts[0];

  return (
    <ScreenFrame
      eyebrow="Receipt detail"
      title={receipt.vendor}
      description="The trust decision stays tight: confirm the vendor, amount, and category, then understand exactly what will sync next."
    >
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <StatusPill label={receipt.status.replace("_", " ")} tone={receiptTone(receipt.status)} />
          <Text style={styles.total}>{receipt.total}</Text>
        </View>
        <Text style={styles.meta}>
          {receipt.category} | {receipt.date} | {Math.round(receipt.confidence * 100)}% confidence
        </Text>
        <Text style={styles.notes}>{receipt.notes}</Text>
      </View>

      <View style={styles.syncStrip}>
        <View style={styles.syncCell}>
          <Text style={styles.syncLabel}>QuickBooks</Text>
          <Text style={styles.syncValue}>Expense ready</Text>
        </View>
        <View style={styles.syncCell}>
          <Text style={styles.syncLabel}>Excel</Text>
          <Text style={styles.syncValue}>Workbook pinned</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trust checks</Text>
        {receipt.decisionSummary.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkMarker} />
            <Text style={styles.sectionCopy}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Line items</Text>
        {receipt.lineItems.map((item) => (
          <View key={`${item.label}-${item.amount}`} style={styles.lineItem}>
            <Text style={styles.lineLabel}>{item.label}</Text>
            <Text style={styles.lineAmount}>{item.amount}</Text>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: 12,
    padding: 22,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  total: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  meta: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  notes: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  syncStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  syncCell: {
    minWidth: "46%",
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: palette.surfaceSoft,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  syncLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  syncValue: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  section: {
    gap: 14,
    paddingVertical: 4,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkMarker: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  sectionCopy: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  lineLabel: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  lineAmount: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
});
