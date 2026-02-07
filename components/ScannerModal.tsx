
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Search } from 'lucide-react';

interface ScannerModalProps {
  onScan: (tagId: string) => void;
  onClose: () => void;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ onScan, onClose }) => {
  const [inputTag, setInputTag] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTag) {
      onScan(inputTag);
      stopCamera();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 bg-[#1e3a5f] text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <Camera size={20} /> Asset Tag Scanner
          </h3>
          <button onClick={() => { stopCamera(); onClose(); }} className="hover:bg-white/10 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 flex items-center justify-center">
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <button onClick={startCamera} className="flex flex-col items-center gap-2 text-slate-500 hover:text-[#1e3a5f] transition">
                <Camera size={48} />
                <span className="font-bold">Start Video Feed</span>
              </button>
            )}
            <div className="absolute inset-4 border-2 border-emerald-400 opacity-50 rounded pointer-events-none" />
          </div>

          <div className="space-y-3">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Or enter ID manually</p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  autoFocus
                  type="text" 
                  value={inputTag}
                  onChange={e => setInputTag(e.target.value)}
                  placeholder="Asset Tag ID (e.g. BAR-001)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button type="submit" className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition">
                <Check size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;
