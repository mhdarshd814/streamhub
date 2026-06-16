import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.streamhub.app",
  appName: "StreamHub",
  webDir: "public",

  server: {
    url: "https://streamhub-ebon.vercel.app",
    cleartext: false,
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;