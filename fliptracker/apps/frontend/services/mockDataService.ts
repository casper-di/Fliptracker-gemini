
import { Shipment, ShipmentStatus, ShipmentDirection, Milestone } from "../types";

const CARRIERS = ["Amazon Logistics", "DHL Express", "UPS WorldShip", "FedEx Premium", "Colissimo", "Chronopost", "La Poste", "DPD Group"];
const SENDERS = [
  "Apple Store Online", 
  "Amazon.fr", 
  "Zalando SE", 
  "Nike Official Store", 
  "Le Bon Coin",
  "Nespresso",
  "Veepee",
  "Asos France",
  "Fnac Darty",
  "Back Market"
];

const ADDRESSES = [
  "123 Rue de la Paix, 75001 Paris, France",
  "Avenue des Champs-Élysées, 75008 Paris",
  "42 Deep Space Road, London, E1 6AN",
  "1600 Amphitheatre Parkway, Mountain View, CA",
  "8 Rue du Faubourg Saint-Honoré, 75008 Paris"
];

const PICKUP_LOCATIONS = [
  { name: "Relais Colis Express - Tabac de la Gare", addr: "15 Rue de la Logistique, 75010 Paris" },
  { name: "Locker Amazon - HUB", addr: "Centre Commercial Italie 2, 75013 Paris" },
  { name: "Point Poste - Super U", addr: "8 Avenue de la République, 92100 Boulogne" },
  { name: "PickUp Station", addr: "Gare du Nord - Niveau -1, 75010 Paris" },
  { name: "Carrefour City - Retrait", addr: "22 Rue Monge, 75005 Paris" }
];

const STATUSES = Object.values(ShipmentStatus);

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateTrackingId = (carrier: string) => {
  if (carrier.includes("UPS")) return `1Z${Math.random().toString(36).toUpperCase().substr(2, 16)}`;
  if (carrier.includes("Amazon")) return `TBA${Math.floor(Math.random() * 1000000000000)}`;
  return `${Math.random().toString(36).toUpperCase().substr(2, 2)}${Math.floor(Math.random() * 1000000000)}${Math.random().toString(36).toUpperCase().substr(2, 2)}`;
};

export const generateMockShipments = (count: number): Shipment[] => {
  return Array.from({ length: count }).map((_, i) => {
    const carrier = getRandomItem(CARRIERS);
    const sender = getRandomItem(SENDERS);
    const now = new Date();
    
    // Distribute statuses for testing
    let status = getRandomItem(STATUSES);
    
    // Force some specifics for first few to guarantee UI visibility
    if (i < 5) status = ShipmentStatus.PICKUP_AVAILABLE;
    if (i >= 5 && i < 8) status = ShipmentStatus.DELAYED;
    if (i === 9) status = ShipmentStatus.OUT_FOR_DELIVERY;

    const history: Milestone[] = [
      {
        id: `m-${i}-1`,
        status: status,
        timestamp: new Date(now.getTime() - Math.random() * 86400000).toISOString(),
        description: status === ShipmentStatus.PICKUP_AVAILABLE 
          ? `Prêt à être récupéré chez le commerçant.` 
          : status === ShipmentStatus.DELAYED 
          ? "Retard dû à un volume exceptionnel de colis."
          : `L'envoi est en transit via ${carrier}.`
      },
      {
        id: `m-${i}-2`,
        status: ShipmentStatus.LABEL_CREATED,
        timestamp: new Date(now.getTime() - 172800000).toISOString(),
        description: "L'étiquette a été créée par l'expéditeur."
      }
    ];

    const isPickup = status === ShipmentStatus.PICKUP_AVAILABLE;
    const pickupLoc = isPickup ? getRandomItem(PICKUP_LOCATIONS) : null;
    const estimated = new Date(now.getTime() + (Math.random() * 10 - 5) * 86400000);

    return {
      id: `mock-${i}-${Math.random().toString(36).substr(2, 5)}`,
      userId: 'local-user',
      trackingNumber: generateTrackingId(carrier),
      carrier: carrier,
      sender: sender,
      recipient: "Moi",
      direction: ShipmentDirection.INBOUND,
      status: status,
      estimatedDelivery: estimated.toISOString(),
      lastUpdated: now.toISOString(),
      destinationAddress: isPickup ? pickupLoc?.addr : getRandomItem(ADDRESSES),
      history: history,
      pickupInfo: isPickup ? {
        locationName: pickupLoc?.name,
        address: pickupLoc?.addr,
        pickupDate: now.toISOString(),
        deadlineDate: new Date(now.getTime() + (Math.random() * 7) * 86400000).toISOString(),
        pickupCode: Math.floor(1000 + Math.random() * 9000).toString()
      } : undefined
    };
  });
};
