import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { AppState, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenFrame } from "@/components/screen-frame";
import { StatusPill } from "@/components/status-pill";
import {
  type ApiReceipt,
  type CapturedReceiptAsset,
  approveReceipt,
  getDefaultMobileIdentity,
  getIntegrationHealth,
  uploadCapturedReceipt,
} from "@/lib/backend-api";
import {
  type OfflineQueueRecord,
  type OfflineQueueState,
  createOfflineQueueRecord,
  listOfflineQueueRecords,
  queueRecordDetail,
  queueStateMeta,
  updateOfflineQueueRecord,
} from "@/lib/offline-queue";
import { palette } from "@/lib/theme";

const defaultIdentity = getDefaultMobileIdentity();

function queueTone(state: OfflineQueueState): "accent" | "warm" | "neutral" | "danger" {
  switch (state) {
    case "queued_offline":
      return "warm";
    case "uploading":
    case "approved":
      return "accent";
    case "processing":
    case "review_required":
    case "synced":
      return "neutral";
    default:
      return "danger";
  }
}

function receiptStatusToQueueState(status: string): OfflineQueueState {
  switch (status) {
    case "review_required":
      return "review_required";
    case "approved":
      return "approved";
    case "synced":
      return "synced";
    case "failed":
      return "failed";
    case "syncing":
      return "approved";
    case "processing":
      return "processing";
    default:
      return "processing";
  }
}

function moneyLabel(receipt: ApiReceipt | null) {
  if (!receipt?.total) {
    return "Pending";
  }
  const numeric = Number(receipt.total);
  if (Number.isNaN(numeric)) {
    return receipt.total;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: receipt.currency || "USD",
  }).format(numeric);
}

export default function CaptureScreen() {
  const identity = defaultIdentity;
  const [asset, setAsset] = useState<CapturedReceiptAsset | null>(null);
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null);
  const [queueRecords, setQueueRecords] = useState<OfflineQueueRecord[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [queueState, setQueueState] = useState<OfflineQueueState>("queued_offline");
  const [statusMessage, setStatusMessage] = useState("Take a photo or choose one from your library.");
  const [readyTargets, setReadyTargets] = useState<Array<"quickbooks" | "excel">>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isRetryingQueue, setIsRetryingQueue] = useState(false);
  const queuedCount = queueRecords.filter((record) => record.state === "queued_offline").length;
  const activeCount = queueRecords.filter(
    (record) => record.state === "uploading" || record.state === "processing",
  ).length;
  const failedCount = queueRecords.filter((record) => record.state === "failed").length;
  const retryableCount = queuedCount + failedCount;

  useEffect(() => {
    let isCancelled = false;

    async function loadIntegrationHealth() {
      try {
        const health = await getIntegrationHealth(identity);
        if (!isCancelled) {
          setReadyTargets(
            health.sync_ready_targets.filter((target): target is "quickbooks" | "excel" =>
              target === "quickbooks" || target === "excel",
            ),
          );
        }
      } catch {
        if (!isCancelled) {
          setReadyTargets([]);
        }
      }
    }

    void loadIntegrationHealth();

    return () => {
      isCancelled = true;
    };
  }, [identity]);

  useEffect(() => {
    let isCancelled = false;

    async function loadQueue() {
      const records = await listOfflineQueueRecords();
      if (isCancelled) {
        return;
      }

      setQueueRecords(records);
      if (records[0]) {
        openQueueRecord(records[0]);
      }
    }

    void loadQueue();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void retryQueuedReceipts(false);
      }
    });
    const interval = setInterval(() => {
      void retryQueuedReceipts(false);
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [isBusy, isRetryingQueue]);

  function openQueueRecord(record: OfflineQueueRecord) {
    setActiveQueueId(record.id);
    setAsset(record.asset);
    setNotes(record.notes);
    setReceipt(null);
    setQueueState(record.state);
    setStatusMessage(queueRecordDetail(record));
  }

  async function refreshQueue(activeRecordId = activeQueueId) {
    const records = await listOfflineQueueRecords();
    setQueueRecords(records);
    const activeRecord = records.find((record) => record.id === activeRecordId);
    if (activeRecord) {
      setQueueState(activeRecord.state);
      setStatusMessage(queueRecordDetail(activeRecord));
    }
  }

  async function patchActiveQueue(
    recordId: string,
    patch: Partial<Omit<OfflineQueueRecord, "id" | "createdAt">>,
  ) {
    const updated = await updateOfflineQueueRecord(recordId, patch);
    await refreshQueue(recordId);
    if (updated) {
      setQueueState(updated.state);
      setStatusMessage(queueRecordDetail(updated));
    }
    return updated;
  }

  async function processQueueRecord(record: OfflineQueueRecord) {
    await updateOfflineQueueRecord(record.id, {
      state: "uploading",
      lastError: null,
    });
    if (record.id === activeQueueId) {
      setQueueState("uploading");
      setStatusMessage("Retrying upload from the saved device queue...");
    }

    try {
      await updateOfflineQueueRecord(record.id, { state: "processing" });
      if (record.id === activeQueueId) {
        setQueueState("processing");
        setStatusMessage("Receipt uploaded. Waiting for extraction...");
      }
      const uploadedReceipt = await uploadCapturedReceipt(identity, record.asset, record.notes);
      const nextState = receiptStatusToQueueState(uploadedReceipt.status);
      await updateOfflineQueueRecord(record.id, {
        state: nextState,
        receiptId: uploadedReceipt.id,
        label: uploadedReceipt.merchant_name || "Receipt ready for review",
        lastError: uploadedReceipt.processing_error,
      });
      if (record.id === activeQueueId) {
        setReceipt(uploadedReceipt);
        setQueueState(nextState);
        setStatusMessage(
          uploadedReceipt.status === "failed"
            ? uploadedReceipt.processing_error || "Receipt processing failed."
            : "Receipt fields are ready for review.",
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Upload failed.";
      const lowerDetail = detail.toLowerCase();
      const nextState =
        lowerDetail.includes("network") || lowerDetail.includes("failed to fetch") ? "queued_offline" : "failed";
      await updateOfflineQueueRecord(record.id, {
        state: nextState,
        lastError: detail,
      });
      if (record.id === activeQueueId) {
        setQueueState(nextState);
        setStatusMessage(detail);
      }
    }
  }

  async function retryQueuedReceipts(includeFailed: boolean) {
    if (isBusy || isRetryingQueue) {
      return;
    }

    const records = await listOfflineQueueRecords();
    const retryableRecords = records.filter(
      (record) => record.state === "queued_offline" || (includeFailed && record.state === "failed"),
    );
    if (!retryableRecords.length) {
      return;
    }

    setIsRetryingQueue(true);
    try {
      for (const record of retryableRecords.slice(0, 3)) {
        await processQueueRecord(record);
      }
      await refreshQueue();
    } finally {
      setIsRetryingQueue(false);
    }
  }

  function handleNotesChange(nextNotes: string) {
    setNotes(nextNotes);
    if (!activeQueueId) {
      return;
    }

    setQueueRecords((records) =>
      records.map((record) => (record.id === activeQueueId ? { ...record, notes: nextNotes } : record)),
    );
    void updateOfflineQueueRecord(activeQueueId, { notes: nextNotes });
  }

  async function pickReceipt(source: "camera" | "library") {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setQueueState("failed");
        setStatusMessage("Camera permission is needed to scan receipts.");
        return;
      }
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.72,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.72,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const pickedAsset = result.assets[0];
    const nextAsset: CapturedReceiptAsset = {
      uri: pickedAsset.uri,
      fileName: pickedAsset.fileName,
      mimeType: pickedAsset.mimeType,
      fileSize: pickedAsset.fileSize,
    };
    const queueRecord = await createOfflineQueueRecord(nextAsset, notes);
    const records = await listOfflineQueueRecords();

    setQueueRecords(records);
    setActiveQueueId(queueRecord.id);
    setAsset(queueRecord.asset);
    setReceipt(null);
    setQueueState(queueRecord.state);
    setStatusMessage("Receipt is saved on this device. Upload when the connection is stable.");
  }

  async function uploadSelectedReceipt() {
    if (!asset) {
      setStatusMessage("Capture or choose a receipt first.");
      return;
    }

    setIsBusy(true);

    let queueId = activeQueueId;
    let uploadAsset = asset;
    if (!queueId) {
      const queueRecord = await createOfflineQueueRecord(asset, notes);
      queueId = queueRecord.id;
      uploadAsset = queueRecord.asset;
      setActiveQueueId(queueId);
      setAsset(queueRecord.asset);
    }

    await patchActiveQueue(queueId, {
      state: "uploading",
      notes,
      lastError: null,
    });
    setStatusMessage("Uploading the receipt image to protected storage...");

    try {
      await patchActiveQueue(queueId, { state: "processing" });
      const uploadedReceipt = await uploadCapturedReceipt(identity, uploadAsset, notes);
      const nextState = receiptStatusToQueueState(uploadedReceipt.status);
      setReceipt(uploadedReceipt);
      await patchActiveQueue(queueId, {
        state: nextState,
        receiptId: uploadedReceipt.id,
        label: uploadedReceipt.merchant_name || "Receipt ready for review",
        lastError: uploadedReceipt.processing_error,
      });
      setStatusMessage(
        uploadedReceipt.status === "failed"
          ? uploadedReceipt.processing_error || "Receipt processing failed."
          : "Receipt fields are ready for review.",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Upload failed.";
      const nextState = detail.toLowerCase().includes("network") ? "queued_offline" : "failed";
      await patchActiveQueue(queueId, {
        state: nextState,
        lastError: detail,
      });
      setStatusMessage(detail);
    } finally {
      setIsBusy(false);
    }
  }

  async function approveAndSync() {
    if (!receipt) {
      return;
    }

    setIsBusy(true);
    const queueId = activeQueueId;
    if (queueId) {
      await patchActiveQueue(queueId, { state: "approved", lastError: null });
    }
    setStatusMessage(
      readyTargets.length ? "Approving and queueing connected sync targets..." : "Approving receipt locally...",
    );

    try {
      const approved = await approveReceipt(identity, receipt.id, readyTargets);
      setReceipt(approved);
      const nextState = receiptStatusToQueueState(approved.status);
      if (queueId) {
        await patchActiveQueue(queueId, {
          state: nextState,
          receiptId: approved.id,
          label: approved.merchant_name || "Approved receipt",
          lastError: approved.processing_error,
        });
      } else {
        setQueueState(nextState);
      }
      setStatusMessage(
        readyTargets.length
          ? "Approved and queued for connected accounting systems."
          : "Approved. Connect QuickBooks or Excel to sync.",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Approval failed.";
      if (queueId) {
        await patchActiveQueue(queueId, { state: "failed", lastError: detail });
      } else {
        setQueueState("failed");
      }
      setStatusMessage(detail);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <ScreenFrame
      eyebrow="Capture"
      title="Scan, review, and sync without losing the receipt."
      description="Camera capture, library upload, queue state, OCR progress, and approval all stay on the same screen."
    >
      <View style={styles.stage}>
        <View style={styles.stageHeader}>
          <Text style={styles.stageLabel}>Receipt scanner</Text>
          <StatusPill label={queueStateMeta[queueState].label} tone={queueTone(queueState)} />
        </View>

        <View style={styles.cameraCanvas}>
          {asset ? (
            <Image source={{ uri: asset.uri }} style={styles.receiptPreview} />
          ) : (
            <View style={styles.receiptGuide}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
              <Text style={styles.guideTitle}>Align the full receipt</Text>
              <Text style={styles.guideCopy}>Crop, compress, and queue locally if the connection drops.</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryAction} onPress={() => pickReceipt("camera")} disabled={isBusy}>
            <Text style={styles.primaryActionText}>Capture receipt</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => pickReceipt("library")} disabled={isBusy}>
            <Text style={styles.secondaryActionText}>Upload from library</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={handleNotesChange}
          placeholder="Add a business note before upload"
          placeholderTextColor={palette.muted}
        />

        <Pressable style={[styles.uploadAction, !asset && styles.disabledAction]} onPress={uploadSelectedReceipt} disabled={!asset || isBusy}>
          <Text style={styles.uploadActionText}>{isBusy ? "Working..." : "Upload and extract"}</Text>
        </Pressable>
      </View>

      <View style={styles.liveStatusCard}>
        <View style={styles.liveStatusHeader}>
          <View>
            <Text style={styles.sectionTitle}>Live receipt status</Text>
            <Text style={styles.queueDetail}>{statusMessage}</Text>
          </View>
          <Text style={styles.healthValue}>{moneyLabel(receipt)}</Text>
        </View>

        <View style={styles.receiptFacts}>
          <View style={styles.factCell}>
            <Text style={styles.healthLabel}>Vendor</Text>
            <Text style={styles.factValue}>{receipt?.merchant_name || "Pending"}</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.healthLabel}>Category</Text>
            <Text style={styles.factValue}>{receipt?.category_name || "Needs review"}</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.healthLabel}>Sync targets</Text>
            <Text style={styles.factValue}>{readyTargets.length ? readyTargets.join(" + ") : "Connect first"}</Text>
          </View>
        </View>

        {receipt ? (
          <Pressable style={styles.primaryAction} onPress={approveAndSync} disabled={isBusy || !!receipt.approved_at}>
            <Text style={styles.primaryActionText}>
              {receipt.approved_at ? "Approved" : readyTargets.length ? "Approve and sync" : "Approve receipt"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.healthStrip}>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>{queuedCount}</Text>
          <Text style={styles.healthLabel}>Queued offline</Text>
        </View>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>{activeCount}</Text>
          <Text style={styles.healthLabel}>Uploading or processing</Text>
        </View>
        <View style={styles.healthCell}>
          <Text style={styles.healthValue}>{failedCount}</Text>
          <Text style={styles.healthLabel}>Need attention</Text>
        </View>
      </View>

      {retryableCount > 0 ? (
        <Pressable
          style={[styles.retryQueueAction, (isBusy || isRetryingQueue) && styles.disabledAction]}
          onPress={() => retryQueuedReceipts(true)}
          disabled={isBusy || isRetryingQueue}
        >
          <Text style={styles.retryQueueActionText}>
            {isRetryingQueue ? "Retrying queue..." : `Retry ${retryableCount} queued receipt${retryableCount === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Queue health</Text>
        <Text style={styles.sectionMeta}>Resumes on reconnect</Text>
      </View>

      <View style={styles.queueList}>
        {queueRecords.length === 0 ? (
          <View style={styles.queueEmpty}>
            <Text style={styles.queueLabel}>No receipts queued yet</Text>
            <Text style={styles.queueDetail}>Captured receipts will appear here and survive app restarts.</Text>
          </View>
        ) : null}
        {queueRecords.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.queueRow, item.id === activeQueueId && styles.queueRowActive]}
            onPress={() => openQueueRecord(item)}
          >
            <View style={styles.queueTop}>
              <Text style={styles.queueLabel}>{item.label}</Text>
              <StatusPill label={queueStateMeta[item.state].label} tone={queueTone(item.state)} />
            </View>
            <Text style={styles.queueDetail}>{queueRecordDetail(item)}</Text>
          </Pressable>
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
  receiptPreview: {
    width: "100%",
    minHeight: 248,
    borderRadius: 18,
    backgroundColor: palette.surfaceRaised,
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
  notesInput: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceSoft,
    color: palette.ink,
    fontSize: 14,
  },
  uploadAction: {
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: "center",
  },
  disabledAction: {
    opacity: 0.48,
  },
  uploadActionText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  liveStatusCard: {
    gap: 16,
    padding: 20,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  liveStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  receiptFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  factCell: {
    minWidth: "30%",
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: palette.surfaceSoft,
  },
  factValue: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "capitalize",
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
  retryQueueAction: {
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceSoft,
    alignItems: "center",
  },
  retryQueueActionText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
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
  queueRowActive: {
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceSoft,
  },
  queueEmpty: {
    gap: 8,
    paddingVertical: 18,
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
