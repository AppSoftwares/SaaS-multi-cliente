// Utilidad mínima ESC/POS para impresoras térmicas de 58/80mm por
// WebUSB/Web Bluetooth. Ambas API son experimentales y no están en el DOM
// lib estándar de TS, por eso se declaran aquí los tipos mínimos usados
// (evitando `any`).

const ESC = 0x1b;
const GS = 0x1d;

// Arma el buffer: init + texto (una línea por elemento) + salto + corte.
export function construirTicketEscPos(lineas: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const partes: number[] = [ESC, 0x40]; // init
  for (const linea of lineas) {
    partes.push(...encoder.encode(linea), 0x0a);
  }
  partes.push(0x0a, 0x0a, 0x0a);
  partes.push(GS, 0x56, 0x01); // corte parcial
  return new Uint8Array(partes);
}

// --- WebUSB (tipos mínimos) ---
interface UsbEndpoint {
  direction: string;
  endpointNumber: number;
}
interface UsbDevice {
  configuration: { interfaces: Array<{ interfaceNumber: number; alternate: { endpoints: UsbEndpoint[] } }> } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<unknown>;
}
interface UsbNavigator {
  usb?: {
    requestDevice(options: { filters: unknown[] }): Promise<UsbDevice>;
  };
}

export async function imprimirPorUsb(data: Uint8Array): Promise<boolean> {
  try {
    const nav = navigator as unknown as UsbNavigator;
    if (!nav.usb) return false;
    const device = await nav.usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    const iface = device.configuration!.interfaces[0];
    await device.claimInterface(iface.interfaceNumber);
    const endpoint = iface.alternate.endpoints.find((e) => e.direction === "out");
    if (!endpoint) return false;
    await device.transferOut(endpoint.endpointNumber, data);
    await device.close();
    return true;
  } catch {
    return false;
  }
}

// --- Web Bluetooth (tipos mínimos) ---
// Servicio genérico usado por la mayoría de impresoras térmicas Bluetooth.
const BLE_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const BLE_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

interface BleCharacteristic {
  writeValue(data: Uint8Array): Promise<void>;
}
interface BleServer {
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BleCharacteristic> }>;
}
interface BleDevice {
  gatt: { connect(): Promise<BleServer> };
}
interface BluetoothNavigator {
  bluetooth?: {
    requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice>;
  };
}

export async function imprimirPorBluetooth(data: Uint8Array): Promise<boolean> {
  try {
    const nav = navigator as unknown as BluetoothNavigator;
    if (!nav.bluetooth) return false;
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BLE_SERVICE],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE);
    const characteristic = await service.getCharacteristic(BLE_CHAR);
    // Fragmenta en bloques pequeños: muchos módulos BLE limitan el MTU.
    const CHUNK = 180;
    for (let i = 0; i < data.length; i += CHUNK) {
      await characteristic.writeValue(data.slice(i, i + CHUNK));
    }
    return true;
  } catch {
    return false;
  }
}
