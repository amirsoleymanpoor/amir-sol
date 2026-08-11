import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.componentinspector',
  appName: 'بازرسی قطعات',
  webDir: 'dist',
  server: {
    // In production, the app will use the bundled dist files
    // For dev, you can enable url to test with live server
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    Camera: {
      // Camera permissions are handled in AndroidManifest.xml
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      // For debug builds, no signing needed
    },
    // Allow mixed content if your API is HTTP in local network
    allowMixedContent: true,
  },
};

export default config;
