
import { GoogleGenAI, Type } from "@google/genai";
import { ShipmentStatus, ShipmentDirection } from "../types";

// Initialize the Google GenAI SDK with the API key from environment variables.
// Always use the named parameter `apiKey` and use process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SHIPMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shipments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          trackingNumber: { type: Type.STRING, description: "The tracking ID or number" },
          carrier: { type: Type.STRING, description: "Carrier name" },
          sender: { type: Type.STRING, description: "The store or person sending" },
          recipient: { type: Type.STRING, description: "The person receiving" },
          direction: { 
            type: Type.STRING, 
            description: "INBOUND if user is recipient, OUTBOUND if user is sender" 
          },
          status: { 
            type: Type.STRING, 
            description: "ORDERED, LABEL_CREATED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, PICKUP_AVAILABLE, DELIVERED, DELAYED, CANCELLED, RETURN_INITIATED, RETURNED_TO_SENDER" 
          },
          estimatedDelivery: { type: Type.STRING, description: "ISO date string" },
          orderUrl: { type: Type.STRING, description: "URL to the order page on Amazon/Flipkart if found" },
          platformName: { type: Type.STRING, description: "e.g. Amazon, Flipkart, eBay" },
          description: { type: Type.STRING, description: "Brief status update text" },
          destinationAddress: { type: Type.STRING, description: "Full shipping or pickup address mentioned in the email" },
          pickupInfo: {
            type: Type.OBJECT,
            properties: {
              locationName: { type: Type.STRING },
              address: { type: Type.STRING },
              pickupDate: { type: Type.STRING, description: "When it became available for pickup" },
              deadlineDate: { type: Type.STRING, description: "Last day to pickup before return" }
            }
          }
        },
        required: ["trackingNumber", "carrier", "sender", "direction", "status"]
      }
    }
  }
};

export const parseEmailContent = async (emailText: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract shipment details. 
      CRITICAL: Extract the destination address or the pickup point address in full. 
      Identify if the package is ready for collection.
      Extract pickup point name, address, and any deadline.
      Find the order tracking number and carrier.
      Email content:\n\n${emailText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: SHIPMENT_SCHEMA,
        systemInstruction: "Logistics intelligence parser. Extract tracking IDs, full destination addresses, pickup availability, and return deadlines."
      }
    });

    // Directly access the .text property of the GenerateContentResponse object.
    const result = JSON.parse(response.text || '{"shipments": []}');
    return result.shipments;
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
};
