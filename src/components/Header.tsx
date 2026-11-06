import React from 'react';
import { Zap, ExternalLink } from 'lucide-react';
import { GoogleAccount } from '../types';

interface HeaderProps {
  flowTabStatus: 'connected' | 'disconnected' | 'searching';
  onConnectFlowTab: () => void;
  googleAccount: GoogleAccount;
  onToggleGoogleSignIn: () => void;
  queueProgress?: {
    total: number;
    completed: number;
    isRunning: boolean;
    isPaused: boolean;
  };
}

export const Header: React.FC<HeaderProps> = ({
  flowTabStatus,
  onConnectFlowTab,
  googleAccount,
  onToggleGoogleSignIn,
  queueProgress
}) => {
  // Light can ONLY turn green when fully connected: user is signed in AND Flow tab is connected
  const isFullyConnected = flowTabStatus === 'connected' && googleAccount.isSignedIn;

  return (
    <header className="sticky top-0 z-40 bg-[#0c0e14]/95 backdrop-blur-md border-b border-[#1c202a] px-3 sm:px-4 py-2.5 relative before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-blue-600/30 before:via-indigo-500/40 before:to-purple-600/30">
      <div className="max-w-md sm:max-w-xl lg:max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Short Brand Name & Punchy Logo (Never wraps!) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center shadow-md shadow-blue-600/30 text-white font-black text-xs">
            <Zap className="w-4 h-4 fill-current text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-sm font-bold text-white tracking-tight">FlowBatch</h1>
              <span className="text-amber-400 text-xs">✦</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium leading-none">Automator</p>
          </div>
        </div>

        {/* Center: The Flow Connection & Progress Status Beacon */}
        <div className="flex items-center">
          {isFullyConnected ? (
            queueProgress && queueProgress.total > 0 && queueProgress.isRunning ? (
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono select-none"
                title={`Running prompt ${queueProgress.completed + 1} of ${queueProgress.total}`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                <span className="font-semibold text-[11px] tracking-tight">
                  {queueProgress.completed}/{queueProgress.total} Running
                </span>
              </div>
            ) : queueProgress && queueProgress.total > 0 && queueProgress.completed === queueProgress.total ? (
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono select-none"
                title={`All ${queueProgress.total} prompts have been generated successfully`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
                <span className="font-semibold text-[11px] tracking-tight">
                  ✓ All {queueProgress.total} Generated
                </span>
              </div>
            ) : queueProgress && queueProgress.total > 0 && queueProgress.completed > 0 ? (
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono select-none"
                title={`${queueProgress.completed} completed, ${queueProgress.total - queueProgress.completed} remaining`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="font-semibold text-[11px] tracking-tight">
                  {queueProgress.completed}/{queueProgress.total} Done · {queueProgress.total - queueProgress.completed} Left
                </span>
              </div>
            ) : (
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono select-none"
                title="Google Flow tab detected & Google account verified"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
                <span className="font-semibold text-[11px] tracking-tight">Flow Connected</span>
              </div>
            )
          ) : !googleAccount.isSignedIn ? (
            <button
              onClick={onToggleGoogleSignIn}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
              title="Sign in with Google to enable Flow automation"
            >
              <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
              <span className="font-semibold text-[11px] tracking-tight">Login Required</span>
            </button>
          ) : (
            <button
              onClick={onConnectFlowTab}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono transition-colors"
              title="Flow tab not detected. Click to link Flow tab"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-semibold text-[11px] tracking-tight">Flow Offline · Link</span>
              <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
          )}
        </div>

        {/* Right: Clean Google / Gmail Profile Avatar */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onToggleGoogleSignIn}
            className={`flex items-center justify-center p-1 rounded-full border transition-all ${
              googleAccount.isSignedIn
                ? 'bg-[#14161f] hover:bg-[#1c202d] border-[#272b3b]'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
            }`}
            title={googleAccount.isSignedIn ? `Signed in as ${googleAccount.email || 'Google User'}` : 'Click to Sign In with Google'}
          >
            {googleAccount.isSignedIn ? (
              <div className="flex items-center gap-1.5 pr-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[11px] shadow-sm ring-1 ring-white/20">
                  M
                </div>
                <span className="font-medium text-[11px] text-zinc-300 tracking-tight hidden sm:inline">
                  Google
                </span>
              </div>
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-medium">Sign in</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
