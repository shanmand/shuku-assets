
import React, { useState } from 'react';
import { Terminal, Check, Copy, Apple, Cpu, ShieldCheck, HardDrive, Zap, AlertTriangle, Play, RefreshCw, FileWarning, Search, Eye, Bug, Sparkles, FileCode } from 'lucide-react';

const SystemDoc: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);

  // This command is designed to be copy-pasted into the terminal.
  // It uses printf with escaped newlines to recreate the files as pure plain text,
  // bypassing any Rich Text (RTF) corruption from Mac text editors.
  const nuclearFix = `mkdir -p scripts && printf '#!/bin/zsh\\nexport PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\\$PATH"\\nexport NVM_DIR="\\$HOME/.nvm"\\n[ -s "\\$NVM_DIR/nvm.sh" ] && \\. "\\$NVM_DIR/nvm.sh"\\n[[ -s "\\$HOME/.zshrc" ]] && source "\\$HOME/.zshrc"\\ncd "\\$(dirname "\\$0")/.."\\nnpx supabase start >> /tmp/shuku_boot.log 2>&1\\n(npm run dev -- --host >> /tmp/shuku_frontend.log 2>&1 &)\\ndisown\\nsleep 10\\nopen "http://localhost:5173"\\n' > scripts/startup.sh && printf '#!/bin/zsh\\nSCRIPT_DIR=\\$(cd "\\$(dirname "\\$0")" && pwd)\\nPROJECT_ROOT=\\$(cd "\\$SCRIPT_DIR/.." && pwd)\\nPLIST_FILE="\\$HOME/Library/LaunchAgents/com.shuku.assets.plist"\\nchmod +x "\\$SCRIPT_DIR/startup.sh"\\ncat > "\\$PLIST_FILE" <<EOF\\n<?xml version="1.0" encoding="UTF-8"?>\\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\\n<plist version="1.0">\\n<dict>\\n<key>Label</key><string>com.shuku.assets</string>\\n<key>ProgramArguments</key>\\n<array><string>/bin/zsh</string><string>\\$PROJECT_ROOT/scripts/startup.sh</string></array>\\n<key>RunAtLoad</key><true/>\\n<key>WorkingDirectory</key><string>\\$PROJECT_ROOT</string>\\n</dict>\\n</plist>\\nEOF\\nlaunchctl unload "\\$PLIST_FILE" 2>/dev/null\\nlaunchctl load "\\$PLIST_FILE"\\necho "Automation Re-Installed Successfully."\\n' > scripts/install_automation.sh && chmod +x scripts/*.sh && ./scripts/install_automation.sh`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="bg-slate-900 rounded-3xl p-10 text-white shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Apple size={160} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
              <Zap size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">macOS Automation Suite</h2>
              <p className="text-blue-200 text-sm font-medium">Auto-Start & Background Engine</p>
            </div>
          </div>

          {/* NUCLEAR FIX BOX */}
          <div className="bg-emerald-900/20 border-2 border-emerald-500/30 rounded-3xl p-8 mb-10 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2">
              <Sparkles size={16} /> The "Nuclear Fix" (Strongly Recommended)
            </h3>
            <p className="text-sm text-emerald-100/80 mb-6 leading-relaxed">
              If your terminal says <b>"parse error"</b> or <b>"unexpected token"</b>, your script files are likely saved as "Rich Text" by accident. This single command will <b>force-recreate</b> clean, plain-text scripts directly in your folder.
            </p>
            
            <div className="relative group">
              <div className="bg-black/60 p-6 rounded-2xl border border-emerald-500/20 font-mono text-[9px] text-emerald-300 flex items-center justify-between shadow-inner overflow-hidden">
                <code className="break-all whitespace-pre-wrap">{nuclearFix}</code>
                <button 
                  onClick={() => copyToClipboard(nuclearFix, 'nuclear')}
                  className="ml-4 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-2xl transition-all active:scale-95 shadow-lg shrink-0"
                >
                  {copied === 'nuclear' ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest text-center italic">
              * Copy this entire block and paste it into your Terminal *
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <FileCode size={14} className="text-blue-500" /> Preventing Corrupt Files
              </h4>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                macOS <b>TextEdit</b> often saves files in <code>.rtf</code> format even if you type <code>.sh</code>.
                <br/><br/>
                <b>The Fix:</b> Use a real code editor like <b>Cursor</b> or <b>VS Code</b> to create scripts. If you must use TextEdit, press <code>Shift + Command + T</code> to convert to "Plain Text" before saving.
              </p>
            </div>
            
            <div className="space-y-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <ShieldCheck size={14} /> Log Verification
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                To see why the portal isn't loading, run this command:
                <code className="block mt-2 bg-black/40 p-2 rounded text-blue-300">tail -f /tmp/shuku_boot.log</code>
                This will show you real-time logs of the system waking up Docker, Supabase, and the Vite server.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemDoc;
