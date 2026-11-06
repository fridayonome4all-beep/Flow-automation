import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getExtensionFiles } from './extensionCode';
import JSZip from 'jszip';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache (never in localStorage per security requirements)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initDriveAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      if (onFailure) onFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access token not returned by Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedToken = (): string | null => cachedAccessToken;

/**
 * Builds the extension zip blob in-memory from extension source files.
 */
export async function createExtensionZipBlob(): Promise<Blob> {
  const zip = new JSZip();
  const files = getExtensionFiles();

  files.forEach(f => {
    zip.file(f.path, f.content);
  });

  const readme = `# FlowBatch Manifest V3 Extension\n\n1. In Chrome, open chrome://extensions\n2. Toggle Developer Mode ON\n3. Click Load Unpacked and select this folder`;
  zip.file('README.md', readme);

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Uploads FlowBatch-Extension.zip directly to the user's Google Drive.
 */
export async function uploadZipToGoogleDrive(token: string): Promise<{ id: string; name: string; webViewLink?: string }> {
  const blob = await createExtensionZipBlob();

  const metadata = {
    name: 'FlowBatch-Extension.zip',
    mimeType: 'application/zip',
    description: 'FlowBatch Manifest V3 Extension Package'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }));
  form.append('file', blob, 'FlowBatch-Extension.zip');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Direct in-browser local save that bypasses link sandboxing.
 */
export function downloadZipLocally(blob: Blob, filename = 'FlowBatch-Extension.zip') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
