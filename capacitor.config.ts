import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roseindustry.ferreteria',
  appName: 'Ferreteria Rose',
  webDir: 'cap-www',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://TU-DOMINIO.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    // dominios que la WebView puede abrir dentro de la app:
    allowNavigation: ['TU-DOMINIO.vercel.app', '*.supabase.co'],
  },
  ios: { contentInset: 'always' },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#ffffff' },
  },
};

export default config;
