import JSZip from 'jszip';
import { getExtensionFiles } from './extensionCode';

/**
 * Bundles all Manifest V3 extension files into a zip archive and triggers a browser download.
 */
export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();
  const files = getExtensionFiles();

  // Add each file to the root of the zip archive
  files.forEach(file => {
    zip.file(file.path, file.content);
  });

  // Add a handy README with installation instructions for Chrome & Quetta
  const readmeContent = `# FlowBatch - Google Flow Automator (Manifest V3)

## How to Install in Google Chrome (Desktop):
1. Unzip this folder to a local directory on your computer.
2. Open Chrome and navigate to: chrome://extensions
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" in the top-left corner.
5. Select the unzipped folder containing manifest.json.
6. Open https://labs.google/fx/tools/flow and click the FlowBatch icon in your extensions toolbar!

## How to Install in Quetta / Kiwi Browser (Android / Mobile):
1. Extract the downloaded .zip file on your device.
2. In Quetta Browser, open the menu (three dots ⋮) -> Extensions (or chrome://extensions).
3. Toggle "Developer mode" ON.
4. Tap "+ (from .zip / .crx / userdir)" or "Load unpacked" and select the unzipped directory.
5. Navigate to https://labs.google/fx/tools/flow, log in, and launch FlowBatch from the extensions menu.
`;
  zip.file('README.md', readmeContent);

  // Generate the zip file as a blob
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FlowBatch-Chrome-Extension-v2.5.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
