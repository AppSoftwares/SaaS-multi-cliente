import { Capacitor } from "@capacitor/core";

// Retorna verdadero si la app corre en un dispositivo móvil (iOS/Android) con Capacitor
export function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

// Retorna la plataforma actual ('android', 'ios', o 'web')
export function plataforma(): "android" | "ios" | "web" {
  return Capacitor.getPlatform() as "android" | "ios" | "web";
}

// Escáner de Código de Barras nativo
export async function escanearCodigoBarraNativo(): Promise<string | null> {
  if (!esNativo()) return null;
  try {
    const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");

    const status = await BarcodeScanner.checkPermissions();
    if (status.camera !== "granted") {
      const request = await BarcodeScanner.requestPermissions();
      if (request.camera !== "granted") {
        throw new Error("Permiso de cámara denegado");
      }
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.Code128,
        BarcodeFormat.QrCode,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
      ],
    });

    if (barcodes && barcodes.length > 0) {
      return barcodes[0].rawValue || barcodes[0].displayValue || null;
    }
  } catch (error) {
    console.error("Error en escáner nativo:", error);
  }
  return null;
}

// Dictado por voz nativo
export async function iniciarDictadoNativo(
  onResult: (texto: string) => void,
  onError: (err: string) => void
): Promise<() => void> {
  if (!esNativo()) return () => {};
  try {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");

    const status = await SpeechRecognition.checkPermissions();
    if (status.speechRecognition !== "granted") {
      await SpeechRecognition.requestPermissions();
    }

    await SpeechRecognition.removeAllListeners();

    SpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
      if (data.matches && data.matches.length > 0) {
        onResult(data.matches[0]);
      }
    });

    await SpeechRecognition.start({
      language: "es-VE",
      maxResults: 2,
      prompt: "Hable ahora...",
      partialResults: true,
      popup: false,
    });

    return async () => {
      try {
        await SpeechRecognition.stop();
        await SpeechRecognition.removeAllListeners();
      } catch {}
    };
  } catch (error: any) {
    console.error("Error en dictado nativo:", error);
    onError(error.message || "Error al iniciar reconocimiento de voz");
    return () => {};
  }
}

// Compartir o Guardar Archivos (Excel/PDF)
export async function compartirArchivoNativo(
  nombreArchivo: string,
  base64Data: string,
  _mimeType: string = "application/octet-stream"
): Promise<boolean> {
  if (!esNativo()) return false;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const result = await Filesystem.writeFile({
      path: nombreArchivo,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: nombreArchivo,
      url: result.uri,
      dialogTitle: "Compartir o guardar archivo",
    });

    return true;
  } catch (error) {
    console.error("Error al guardar/compartir archivo nativo:", error);
    return false;
  }
}

// Abrir URL externa de forma segura en el navegador del sistema o in-app browser
export async function abrirUrlExterna(url: string): Promise<void> {
  if (esNativo()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch (e) {
      console.error("Error abriendo navegador nativo:", e);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// Registrar notificaciones push nativas
export async function registrarPushNotificationsNativo(
  onTokenObtenido?: (token: string) => void
): Promise<void> {
  if (!esNativo()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === "granted") {
      await PushNotifications.register();

      PushNotifications.addListener("registration", (token) => {
        if (onTokenObtenido && token.value) {
          onTokenObtenido(token.value);
        }
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("Error al registrar notificaciones push:", error);
      });
    }
  } catch (error) {
    console.error("Error en PushNotifications:", error);
  }
}

// Configurar comportamiento de botones nativos y UI al iniciar
export async function inicializarAppNativa(): Promise<void> {
  if (!esNativo()) return;
  try {
    const { App } = await import("@capacitor/app");
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const { SplashScreen } = await import("@capacitor/splash-screen");

    await SplashScreen.hide();
    await StatusBar.setStyle({ style: Style.Dark });

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });
  } catch (error) {
    console.error("Error inicializando app nativa:", error);
  }
}
