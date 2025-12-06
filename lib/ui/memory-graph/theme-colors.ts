// Theme-aware color palette for memory graph
export const getThemeColors = (theme: 'light' | 'dark') => {
  if (theme === 'light') {
    return {
      background: {
        primary: "#f8fafc", // Light gray background
        secondary: "#f1f5f9", // Slightly darker light gray
        accent: "#e2e8f0", // Card backgrounds
      },
      document: {
        primary: "rgba(15, 23, 42, 0.04)", // Subtle dark overlay
        secondary: "rgba(15, 23, 42, 0.08)", // More visible
        accent: "rgba(15, 23, 42, 0.12)", // Hover state
        border: "rgba(15, 23, 42, 0.20)", // Sharp borders
        glow: "rgba(59, 130, 246, 0.3)", // Blue glow for interaction
      },
      memory: {
        primary: "rgba(59, 130, 246, 0.06)", // Subtle blue
        secondary: "rgba(59, 130, 246, 0.12)", // More visible
        accent: "rgba(59, 130, 246, 0.18)", // Hover state
        border: "rgba(59, 130, 246, 0.30)", // Sharp borders
        glow: "rgba(59, 130, 246, 0.4)", // Blue glow for interaction
      },
      connection: {
        weak: "rgba(71, 85, 105, 0.15)", // Subtle gray
        memory: "rgba(71, 85, 105, 0.25)", // Memory connections
        medium: "rgba(71, 85, 105, 0.35)", // Medium visibility
        strong: "rgba(71, 85, 105, 0.5)", // Strong connection
      },
      text: {
        primary: "#0f172a", // Dark blue-gray
        secondary: "#334155", // Medium gray
        muted: "#64748b", // Light gray
      },
      accent: {
        primary: "rgba(59, 130, 246, 0.8)", // Clean blue
        secondary: "rgba(99, 102, 241, 0.7)", // Clean purple
        glow: "rgba(59, 130, 246, 0.5)", // Subtle glow
        amber: "rgba(245, 158, 11, 0.8)", // Amber for expiring
        emerald: "rgba(16, 185, 129, 0.6)", // Emerald for new
      },
      status: {
        forgotten: "rgba(220, 38, 38, 0.25)", // Red for forgotten
        expiring: "rgba(245, 158, 11, 0.8)", // Amber for expiring soon
        new: "rgba(16, 185, 129, 0.6)", // Emerald for new memories
      },
      relations: {
        updates: "rgba(147, 77, 253, 0.6)", // purple
        extends: "rgba(16, 185, 129, 0.6)", // green
        derives: "rgba(59, 130, 246, 0.6)", // blue
      },
      grid: {
        line: "rgba(71, 85, 105, 0.08)", // Grid lines
        dot: "rgba(71, 85, 105, 0.15)", // Grid dots
      }
    };
  }

  // Dark theme (original colors)
  return {
    background: {
      primary: "#0f1419", // Deep dark blue-gray
      secondary: "#1a1f29", // Slightly lighter
      accent: "#252a35", // Card backgrounds
    },
    document: {
      primary: "rgba(255, 255, 255, 0.06)", // Subtle glass white
      secondary: "rgba(255, 255, 255, 0.12)", // More visible
      accent: "rgba(255, 255, 255, 0.18)", // Hover state
      border: "rgba(255, 255, 255, 0.25)", // Sharp borders
      glow: "rgba(147, 197, 253, 0.4)", // Blue glow for interaction
    },
    memory: {
      primary: "rgba(147, 197, 253, 0.08)", // Subtle glass blue
      secondary: "rgba(147, 197, 253, 0.16)", // More visible
      accent: "rgba(147, 197, 253, 0.24)", // Hover state
      border: "rgba(147, 197, 253, 0.35)", // Sharp borders
      glow: "rgba(147, 197, 253, 0.5)", // Blue glow for interaction
    },
    connection: {
      weak: "rgba(148, 163, 184, 0)", // Very subtle
      memory: "rgba(148, 163, 184, 0.3)", // Very subtle
      medium: "rgba(148, 163, 184, 0.125)", // Medium visibility
      strong: "rgba(148, 163, 184, 0.4)", // Strong connection
    },
    text: {
      primary: "#ffffff", // Pure white
      secondary: "#e2e8f0", // Light gray
      muted: "#94a3b8", // Medium gray
    },
    accent: {
      primary: "rgba(59, 130, 246, 0.7)", // Clean blue
      secondary: "rgba(99, 102, 241, 0.6)", // Clean purple
      glow: "rgba(147, 197, 253, 0.6)", // Subtle glow
      amber: "rgba(251, 165, 36, 0.8)", // Amber for expiring
      emerald: "rgba(16, 185, 129, 0.4)", // Emerald for new
    },
    status: {
      forgotten: "rgba(220, 38, 38, 0.15)", // Red for forgotten
      expiring: "rgba(251, 165, 36, 0.8)", // Amber for expiring soon
      new: "rgba(16, 185, 129, 0.4)", // Emerald for new memories
    },
    relations: {
      updates: "rgba(147, 77, 253, 0.5)", // purple
      extends: "rgba(16, 185, 129, 0.5)", // green
      derives: "rgba(147, 197, 253, 0.5)", // blue
    },
    grid: {
      line: "rgba(148, 163, 184, 0.03)", // Grid lines
      dot: "rgba(148, 163, 184, 0.08)", // Grid dots
    }
  };
};

export type ThemeColors = ReturnType<typeof getThemeColors>;