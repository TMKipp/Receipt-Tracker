import type { ReactNode } from "react";

import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { palette } from "@/lib/theme";

type ScreenFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ScreenFrame({ eyebrow, title, description, children }: ScreenFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Ledger Lens</Text>
            <Text style={styles.brandMeta}>Mobile workspace</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Trial active</Text>
          </View>
        </View>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 128,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brandBlock: {
    gap: 3,
  },
  brand: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  brandMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceRaised,
  },
  badgeText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  header: {
    paddingTop: 8,
    gap: 10,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: palette.ink,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.9,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
