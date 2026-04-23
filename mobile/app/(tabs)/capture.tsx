import { StyleSheet, Text, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { StatusPill } from "@/components/status-pill";
import { queueItems } from "@/lib/mock-data";
import { queueStateMeta } from "@/lib/offline-queue";
import { palette } from "@/lib/theme";

function queueTone(state: string): "accent" | "warm" | "neutral" | "danger" {
  switch (state) {
    case "queued offline":
      return "warm";
    case "uploading":
      return "accent";
    case "processing":
      return "neutral";
    default:
      return "danger";
  }
}

export default function CaptureScreen() {
  return (
    <ScreenFrame
      eyebrow="Capture"
      title="Capture stays calm even when the network is not."
      description="Offline queue state, upload progress, and processing trust all stay on the same screen so the receipt never feels lost."
    >
      <View style={styles.stage}>
        <View style={styles.stageHeader}>
          <Text style={styles.stageLabel}>Camera stage</Text>
          <Text style={styles.stageMeta}>Median online processing: 7.8s</Text>
        </View>

        <View style={styles.cameraCanvas}>
          <View style={styles.receiptGuide}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
            <Text style={styles.guideTitle}>Align the full receipt</Text>
            <Text style={styles.guideCopy}>Crop, compress, and queue locally if the connection drops.</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Capture receipt</Text>
          </View>
          <View style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Upload from library</Text>
          </View>
        </View>
      </View>

      <View style={styles.healthStrip}>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>3</Text>
          <Text style={styles.healthLabel}>Queued offline</Text>
        </View>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>1</Text>
          <Text style={styles.healthLabel}>Uploading now</Text>
        </View>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>98%</Text>
          <Text style={styles.healthLabel}>Sync retry success</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Queue health</Text>
        <Text style={styles.sectionMeta}>Resumes on reconnect</Text>
      </View>

      <View style={styles.queueList}>
        {queueItems.map((item) => (
          <View key={item.id} style={styles.queueRow}>
            <View style={styles.queueTop}>
              <Text style={styles.queueLabel}>{item.label}</Text>
              <StatusPill label={queueStateMeta[item.state].label} tone={queueTone(item.state)} />
            </View>
            <Text style={styles.queueDetail}>{queueStateMeta[item.state].detail}</Text>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  stage: {
    gap: 16,
    padding: 20,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  stageLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  stageMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cameraCanvas: {
    minHeight: 280,
    padding: 16,
    borderRadius: 24,
    backgroundColor: palette.backgroundDeep,
    justifyContent: "center",
  },
  receiptGuide: {
    position: "relative",
    minHeight: 208,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceRaised,
    justifyContent: "flex-end",
    gap: 8,
  },
  cornerTopLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 26,
    height: 26,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: palette.accent,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: palette.accent,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 14,
    left: 14,
    width: 26,
    height: 26,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: palette.accent,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 26,
    height: 26,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: palette.accent,
    borderBottomRightRadius: 8,
  },
  guideTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  guideCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 220,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: palette.ink,
    alignItems: "center",
  },
  primaryActionText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryAction: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    backgroundColor: palette.surfaceSoft,
  },
  secondaryActionText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  healthStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  healthCell: {
    minWidth: "30%",
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.surfaceSoft,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  healthValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  healthLabel: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
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
  queueList: {
    gap: 14,
  },
  queueRow: {
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  queueTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  queueLabel: {
    flex: 1,
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  queueDetail: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
