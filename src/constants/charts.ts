import type { ColorScheme } from "@/constants/theme";

export type GraphColors = {
  noteFill: string;
  noteStroke: string;
  tagFill: string;
  tagStroke: string;
  edge: string;
  edgeActive: string;
  label: string;
  labelMuted: string;
};

const GRAPH_PALETTES: Record<ColorScheme, GraphColors> = {
  light: {
    noteFill: "#c45d3e",
    noteStroke: "#ffffff",
    tagFill: "#4a6fa5",
    tagStroke: "#ffffff",
    edge: "rgba(28, 25, 23, 0.18)",
    edgeActive: "#c45d3e",
    label: "#1c1917",
    labelMuted: "#78716c",
  },
  dark: {
    noteFill: "#e8a87c",
    noteStroke: "#1c1916",
    tagFill: "#7eb0d8",
    tagStroke: "#1c1916",
    edge: "rgba(250, 248, 245, 0.16)",
    edgeActive: "#e8a87c",
    label: "#faf8f5",
    labelMuted: "#a8a29e",
  },
};

export function getGraphColors(theme: ColorScheme): GraphColors {
  return GRAPH_PALETTES[theme];
}
