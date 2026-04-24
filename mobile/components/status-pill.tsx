import { StyleSheet, Text, View } from "react-native";

import { palette } from "@/lib/theme";

type StatusPillProps = {
  label: string;
  tone?: "accent" | "warm" | "neutral" | "danger";
};

export function StatusPill({ label, tone = "accent" }: StatusPillProps) {
  const toneStyles = {
    accent: styles.pillAccent,
    warm: styles.pillWarm,
    neutral: styles.pillNeutral,
    danger: styles.pillDanger,
  };

  const textStyles = {
    accent: styles.textAccent,
    warm: styles.textWarm,
    neutral: styles.textNeutral,
    danger: styles.textDanger,
  };

  return (
    <View style={[styles.pill, toneStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillAccent: {
    backgroundColor: palette.accentSoft,
  },
  pillWarm: {
    backgroundColor: "rgba(184, 109, 42, 0.14)",
  },
  pillNeutral: {
    backgroundColor: palette.neutralSoft,
  },
  pillDanger: {
    backgroundColor: "rgba(166, 69, 54, 0.14)",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  textAccent: {
    color: palette.accent,
  },
  textWarm: {
    color: palette.warm,
  },
  textNeutral: {
    color: palette.ink,
  },
  textDanger: {
    color: palette.danger,
  },
});
