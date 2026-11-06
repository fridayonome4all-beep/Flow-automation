import React, { useState } from 'react';
import { 
  X, 
  HardDrive, 
  Download, 
  Check, 
  ExternalLink, 
  Loader2, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { 
  signInWithGoogleDrive, 
  uploadZipToGoogleDrive, 
  createExtensionZipBlob, 
  downloadZipLocally, 
  getCachedToken 
} from '../services/driveService';
import { GoogleAccount } from '../types';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleAccount: GoogleAccount;
  onUpdateAccount: (acc: Partial<GoogleAccount>) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  googleAccount,
  onUpdateAccount
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [driveResult, setDriveResult] = useState<{ id: string; name: string; webViewLink?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUploadToDrive = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      let token = getCachedToken();
      if (!token) {
        const authRes = await signInWithGoogleDrive();
        if (authRes) {
          token = authRes.accessToken;
          onUpdateAccount({
            isSignedIn: true,
            email: authRes.user.email || 'mtempone222@gmail.com',
            name: authRes.user.displayName || 'Google User'
          });
        }
      }

      if (!token) {
        throw new Error('Google authentication required to access Google Drive.');
      }

      const result = await uploadZipToGoogleDrive(token);
      setDriveResult(result);
    } catch (err: any) {
      console.error('Drive upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload to Google Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDirectDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await createExtensionZipBlob();
      downloadZipLocally(blob, 'FlowBatch-Extension.zip');
    } catch (err: any) {
      console.error('Local download failed:', err);
      setErrorMsg('Failed creating ZIP file locally.');
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0d0e14] border border-[#212638] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c202c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Google Drive &amp; Extension Delivery
              </h3>
              <p className="text-[11px] text-zinc-400">
                Direct package delivery to your Google Drive or device
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#181a24] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account Info */}
        <div className="p-3 rounded-xl bg-[#131620] border border-[#202534] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20">
              M
            </div>
            <div>
              <div className="text-xs font-semibold text-white">
                {googleAccount.email || 'mtempone222@gmail.com'}
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Google Account Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action 1: Upload directly to Google Drive */}
        <div className="p-4 rounded-xl bg-[#141824] border border-blue-900/30 space-y-3">
          <div>
            <span className="text-xs font-semibold text-white">
              Option 1: Save Directly to Google Drive
            </span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Uploads <b>FlowBatch-Extension.zip</b> straight into your personal Google Drive account.
            </p>
          </div>

          {driveResult ? (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Successfully uploaded to your Google Drive!</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Filename: <code className="text-white font-mono">{driveResult.name}</code>
              </p>
              {driveResult.webViewLink && (
                <a
                  href={driveResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors mt-1"
                >
                  <span>Open in Google Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={handleUploadToDrive}
              disabled={isUploading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading to Google Drive...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4" />
                  <span>Upload to My Google Drive</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Action 2: Direct In-Browser Download (Bypasses link blocking) */}
        <div className="p-4 rounded-xl bg-[#12141c] border border-[#212534] space-y-2">
          <div>
            <span className="text-xs font-semibold text-zinc-200">
              Option 2: Direct Device Download
            </span>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Generates the ZIP file directly inside your browser and saves it to your downloads folder immediately.
            </p>
          </div>

          <button
            onClick={handleDirectDownload}
            disabled={isDownloading}
            className="w-full py-2 px-4 rounded-xl bg-[#1c202d] hover:bg-[#252b3d] text-zinc-200 hover:text-white border border-[#2e364c] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading ZIP...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Save ZIP to Device</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="text-center pt-1">
          <button
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
