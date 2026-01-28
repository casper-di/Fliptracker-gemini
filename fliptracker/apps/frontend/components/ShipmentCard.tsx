
import React from 'react';
import { Shipment, ShipmentStatus, ShipmentDirection } from '../types';

interface ShipmentCardProps {
  shipment: Shipment;
  onClick: (shipment: Shipment) => void;
}

const getStatusVisuals = (status: ShipmentStatus) => {
  switch (status) {
    case ShipmentStatus.PICKUP_AVAILABLE: 
      return { icon: 'fa-location-dot', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', strip: 'bg-emerald-500', label: 'Disponible' };
    case ShipmentStatus.OUT_FOR_DELIVERY: 
      return { icon: 'fa-truck-fast', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', strip: 'bg-blue-500', label: 'En livraison' };
    case ShipmentStatus.DELAYED: 
      return { icon: 'fa-triangle-exclamation', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', strip: 'bg-rose-500', label: 'Retardé' };
    case ShipmentStatus.DELIVERED: 
      return { icon: 'fa-check-double', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800', strip: 'bg-slate-400', label: 'Livré' };
    default: 
      return { icon: 'fa-route', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', strip: 'bg-indigo-500', label: 'En transit' };
  }
};

export const ShipmentCard: React.FC<ShipmentCardProps> = ({ shipment, onClick }) => {
  const visuals = getStatusVisuals(shipment.status);
  const isInbound = shipment.direction === ShipmentDirection.INBOUND;
  
  const isPickupSoon = shipment.status === ShipmentStatus.PICKUP_AVAILABLE && shipment.pickupInfo?.deadlineDate && (
    (new Date(shipment.pickupInfo.deadlineDate).getTime() - new Date().getTime()) < 48 * 60 * 60 * 1000
  );

  const statusMessage = shipment.history[0]?.description || 'Mise à jour en attente';
  const displayDate = shipment.status === ShipmentStatus.PICKUP_AVAILABLE 
    ? `Limite: ${new Date(shipment.pickupInfo!.deadlineDate!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
    : shipment.estimatedDelivery 
    ? `Estimé: ${new Date(shipment.estimatedDelivery).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
    : 'Date inconnue';

  return (
    <div 
      onClick={() => onClick(shipment)}
      className="group bg-white dark:bg-slate-800/80 rounded-[22px] mb-3 relative overflow-hidden shadow-sm hover:shadow-md dark:shadow-none active:scale-[0.98] transition-all cursor-pointer border border-slate-100 dark:border-white/5 flex h-32 theme-transition"
    >
      <div className={`w-1.5 h-full ${isPickupSoon ? 'bg-orange-500' : visuals.strip}`}></div>

      <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
        <div className="flex justify-between items-start gap-2">
          <div className="overflow-hidden">
            <h3 className="font-bold text-slate-900 dark:text-white text-[14px] truncate leading-tight mb-0.5">
              {isInbound ? shipment.sender : `À: ${shipment.recipient}`}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">
              {shipment.carrier}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${visuals.bg} ${visuals.color} border border-current border-opacity-10 shrink-0`}>
             <i className={`fas ${visuals.icon} text-[10px]`}></i>
             <span className="text-[9px] font-black uppercase tracking-tight">{visuals.label}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium line-clamp-1">
          {statusMessage}
        </p>

        <div className="flex items-center justify-between mt-auto border-t border-slate-50 dark:border-white/5 pt-2.5">
          <div className="flex items-center gap-1.5">
             <i className="far fa-calendar text-[10px] text-slate-300 dark:text-slate-600"></i>
             <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">{displayDate}</span>
          </div>
          
          <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(shipment.trackingNumber); }}
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300 flex items-center justify-center active:scale-90"
            >
              <i className="far fa-copy text-[10px]"></i>
            </button>
            <button 
              className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center active:scale-90"
            >
              <i className="fas fa-qrcode text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
