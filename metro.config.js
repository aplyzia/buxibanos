const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ensure web resolves packages with "react-native" exports condition.
// Without this, packages like zustand resolve to ESM builds (.mjs)
// that use import.meta, which breaks the web bundle.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: ["browser", "react-native"],
};

module.exports = withNativeWind(config, { input: "./global.css" });
