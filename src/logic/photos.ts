import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Pick a photo from the camera or gallery, square-crop it, shrink it to ≤ 512 px wide (JPEG 70%)
 * and keep it in the app's documents. Returns the local URI, or null if cancelled / denied.
 * With Supabase, this file is what gets uploaded to Storage.
 */
export async function pickPhoto(source: 'camera' | 'gallery'): Promise<string | null | 'denied'> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'denied';
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  let uri = a.uri;
  try {
    const ctx = ImageManipulator.manipulate(a.uri);
    if ((a.width ?? 0) > 512) ctx.resize({ width: 512 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    uri = out.uri;
  } catch {}
  return keep(uri, `p_${Date.now()}.jpg`);
}

async function keep(src: string, name: string) {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create();
    const dest = new File(dir, name);
    await (new File(src) as unknown as { copy: (d: File) => unknown }).copy(dest);
    return dest.uri;
  } catch {
    return src;
  }
}
