
import React, { useState, useRef } from 'react';

interface AddShipmentPageProps {
  onBack: () => void;
  onSubmit: (data: { trackingNumber: string; carrier?: string; customName?: string; content?: string }) => void;
}

export const AddShipmentPage: React.FC<AddShipmentPageProps> = ({ onBack, onSubmit }) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [customName, setCustomName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera for scanning.");
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const simulateScanSuccess = () => {
    setTrackingNumber('1Z999AA10123456789');
    stopScan();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTrackingNumber(text);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  };

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) return;
    setLoading(true);
    await onSubmit({ 
      trackingNumber: trackingNumber.trim(), 
      carrier: carrier.trim(), 
      customName: customName.trim(),
      content: trackingNumber.length > 30 ? trackingNumber : undefined
    });
    setLoading(false);
  };

  const isValid = trackingNumber.trim().length > 3;

  return (
    <div className="bg-slate-50 min-h-full flex flex-col px-5 py-4 animate-in slide-in-from-right duration-300">
      {/* Mini Scan Bar (Compact) */}
      {!isScanning && (
        <button 
          onClick={handleScan}
          className="w-full bg-blue-600 rounded-3xl p-4 mb-6 flex items-center justify-between active:scale-[0.98] shadow-lg shadow-blue-100 transition-all overflow-hidden relative"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <i className="fas fa-camera"></i>
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white leading-none">Scanner un code</p>
              <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-1">QR ou Code-barres</p>
            </div>
          </div>
          <i className="fas fa-chevron-right text-white/40 text-xs mr-2"></i>
        </button>
      )}

      {isScanning ? (
        <div className="relative mb-6 rounded-[32px] overflow-hidden bg-black aspect-square shadow-2xl animate-in zoom-in duration-300">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-[30px] border-black/30 pointer-events-none">
            <div className="w-full h-full border-2 border-blue-500 rounded-2xl animate-pulse relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_20px_blue] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-3">
            <button 
              onClick={simulateScanSuccess}
              className="bg-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-xl active:scale-95"
            >
              Simulate Scan Success
            </button>
            <button 
              onClick={stopScan}
              className="text-white text-[10px] font-black uppercase tracking-widest opacity-70 bg-black/40 px-4 py-2 rounded-full backdrop-blur-md"
            >
              Cancel Scan
            </button>
          </div>
          <style>{`
            @keyframes scan {
              0%, 100% { top: 10%; }
              50% { top: 90%; }
            }
          `}</style>
        </div>
      ) : (
        <div className="space-y-4">
          {/* MANUAL ENTRY CARD */}
          <div className="bg-white rounded-[28px] p-5 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Numéro de suivi</p>
              <button 
                onClick={handlePaste}
                className="text-[9px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1.5 active:opacity-50"
              >
                <i className="far fa-clipboard"></i> Coller
              </button>
            </div>
            
            <div className="relative mb-4">
              <input 
                type="text" 
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ex: 1Z999AA10123456..." 
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-50">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nom personnalisé</label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ex: Commande Amazon Papa" 
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Transporteur</label>
                <input 
                  type="text" 
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="Ex: DHL, UPS, La Poste" 
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* QUICK HELP / INFO */}
          <div className="bg-slate-100/50 rounded-2xl p-4 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
              <i className="fas fa-lightbulb text-xs"></i>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              Vous pouvez aussi coller tout le contenu d'un e-mail pour une détection automatique intelligente.
            </p>
          </div>

          {/* SUBMIT BUTTON - More Compact */}
          <div className="pt-2">
            <button 
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="w-full bg-slate-900 text-white py-4 rounded-[22px] font-black shadow-xl active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-3"
            >
              {loading ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <>
                  <i className="fas fa-plus-circle opacity-40"></i>
                  <span>Suivre ce colis</span>
                </>
              )}
            </button>
          </div>

          <button 
            onClick={onBack}
            className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
};
