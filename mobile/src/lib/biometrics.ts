import * as LocalAuthentication from 'expo-local-authentication';

export async function biometricsAvailable(): Promise<{ available: boolean; label: string }> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return { available: hasHardware && enrolled, label: face ? 'Face ID' : 'biometrics' };
  } catch {
    return { available: false, label: 'biometrics' };
  }
}

export async function authenticate(reason = 'Unlock your CNM account'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
