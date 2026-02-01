
import React, { useState } from 'react';
import { Shipment, ShipmentDirection, ShipmentStatus } from '../types';

interface ShipmentDetailsPageProps {
  shipment: Shipment;
  onBack: () => void;
  allShipments?: Shipment[];
}

export const ShipmentDetailsPage: React.FC<ShipmentDetailsPageProps> = ({ shipment, onBack, allShipments = [] }) => {
  const [showAllPickups, setShowAllPickups] = useState(false);
  const isPickupReady = shipment.status === ShipmentStatus.PICKUP_AVAILABLE;
  const isDelivered = shipment.status === ShipmentStatus.DELIVERED;
  
  // Use metadata from backend
  const displayAddress = (shipment as any).pickupAddress || shipment.pickupInfo?.address || shipment.destinationAddress;
  const qrCodeData = (shipment as any).qrCode || shipment.trackingNumber;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCodeData)}`;
  const pickupCodeDisplay = (shipment as any).withdrawalCode || shipment.pickupInfo?.pickupCode || shipment.trackingNumber.slice(-4);
  const pendingPickups = allShipments.filter(s => s.status === ShipmentStatus.PICKUP_AVAILABLE);
  const parcelTitle = shipment.title || (shipment as any).productName || shipment.sender || 'Colis';

  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case ShipmentStatus.PICKUP_AVAILABLE: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20';
      case ShipmentStatus.DELIVERED: return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
      case ShipmentStatus.DELAYED: return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-white/5';
    }
  };

  if (showAllPickups) {
    return (
      <div className="bg-slate-950 min-h-screen flex flex-col animate-in fade-in duration-300 overflow-y-auto no-scrollbar pb-10">
        <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-40">
           <button onClick={() => setShowAllPickups(false)} className="text-white/40 hover:text-white flex items-center gap-2">
             <i className="fas fa-chevron-left text-xs"></i>
             <span className="text-[10px] font-black uppercase tracking-widest">Retour</span>
           </button>
           <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Mes Retraits</h2>
        </header>
        <div className="px-6 space-y-6">
           {pendingPickups.map((p) => (
             <div key={p.id} className="bg-slate-900 border border-white/5 rounded-[32px] overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                   <div>
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{p.carrier.replace('_', ' ').toUpperCase()}</p>
                     <h3 className="text-sm font-black text-white">{p.sender}</h3>
                   </div>
                   <div className="text-right">
                     <p className="text-lg font-mono font-black text-white">*{(p as any).withdrawalCode || p.pickupInfo?.pickupCode || p.trackingNumber.slice(-4)}</p>
                   </div>
                </div>
                <div className="p-8 flex justify-center bg-white">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent((p as any).qrCode || p.trackingNumber)}`} alt="QR" className="w-40 h-40 mix-blend-multiply" />
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar pb-20 theme-transition">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-40">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center active:scale-90 border border-slate-100 dark:border-white/10 shadow-sm">
          <i className="fas fa-chevron-left text-xs"></i>
        </button>
        <h1 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">FlipTracker Detail</h1>
        <button className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center active:scale-90 border border-slate-100 dark:border-white/10 shadow-sm">
          <i className="fas fa-envelope text-xs"></i>
        </button>
      </header>

      <div className="px-6 space-y-6">
        <section className="text-center py-6">
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border mb-4 text-[11px] font-black uppercase tracking-widest ${getStatusColor(shipment.status)}`}>
            {shipment.status.replace(/_/g, ' ')}
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">
            {parcelTitle}
          </h2>
          {(shipment as any).marketplace && (
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">
              {(shipment as any).marketplace}
            </p>
          )}
          <p className="text-sm font-medium text-slate-500 dark:text-slate-500 mb-1">
            {isDelivered ? 'Colis livré' : isPickupReady ? 'Prêt au retrait' : 'En transit'}
          </p>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-600 mb-3">
            {shipment.carrier.replace('_', ' ').toUpperCase()}
            {shipment.estimatedDelivery && (
              <> • Estimé le <span className="text-slate-900 dark:text-slate-300">{new Date(shipment.estimatedDelivery).toLocaleDateString('fr-FR')}</span></>
            )}
            {(shipment as any).pickupDeadline && (
              <> • Retrait avant le <span className="text-slate-900 dark:text-slate-300">{new Date((shipment as any).pickupDeadline).toLocaleDateString('fr-FR')}</span></>
            )}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-white/5">
            <i className="fas fa-barcode text-slate-400 dark:text-slate-600 text-xs"></i>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{shipment.trackingNumber}</span>
          </div>
          {((shipment as any).itemPrice || shipment.price) && (
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-3">
              {((shipment as any).itemPrice || shipment.price)?.toFixed(2)} {shipment.currency || '€'}
            </p>
          )}
        </section>

        {displayAddress && (
          <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5 theme-transition">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fas fa-map-location-dot text-lg"></i>
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-black text-slate-900 dark:text-white text-lg truncate">
                  {shipment.pickupInfo?.locationName || (shipment as any).recipientName || shipment.sender}
                </h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-500 leading-snug">
                  {displayAddress}
                </p>
                {(shipment as any).productName && (
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-2">
                    📦 {(shipment as any).productName}
                  </p>
                )}
                {(shipment as any).productDescription && (
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                    {(shipment as any).productDescription}
                  </p>
                )}
                {(shipment as any).orderNumber && (
                  <p className="text-xs font-mono text-slate-400 dark:text-slate-600 mt-1">
                    Commande: {(shipment as any).orderNumber}
                  </p>
                )}
                {(shipment as any).senderEmail && (
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                    📧 {(shipment as any).senderEmail}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <i className="fas fa-directions"></i> Itinéraire
              </button>
              {isPickupReady && pendingPickups.length > 1 && (
                <button onClick={() => setShowAllPickups(true)} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2">
                  <i className="fas fa-boxes-stacked"></i> Mes Retraits
                </button>
              )}
            </div>
          </section>
        )}

        <section className="bg-slate-900 dark:bg-slate-900 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative">
          <div className="p-10 text-center bg-slate-800/50">
             <div className="bg-white p-6 rounded-[32px] inline-block mb-6">
                <img src={qrUrl} alt="QR Code" className="w-44 h-44" />
             </div>
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Code de retrait</p>
             <h4 className="text-4xl font-mono font-black text-white tracking-widest">*{pickupCodeDisplay}</h4>
          </div>
          <div className="p-6 text-center border-t border-white/5 bg-slate-900/80">
             <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Scanner au comptoir {shipment.carrier}</p>
          </div>
        </section>
      </div>
    </div>
  );
};
