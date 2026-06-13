import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.streamhub.app",
  appName: "StreamHub",
  webDir: "public",

  server: {
    url: "https://streamhub-ebon.vercel.app",
    cleartext: true,
  },
};

export default config;