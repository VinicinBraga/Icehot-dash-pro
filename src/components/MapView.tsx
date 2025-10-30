import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { mockMapPoints } from "@/lib/mockData";
import { formatNumber } from "@/lib/format";

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapBounds() {
  const map = useMap();
  
  useEffect(() => {
    if (mockMapPoints.length > 0) {
      const bounds = L.latLngBounds(mockMapPoints.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map]);
  
  return null;
}

export function MapView() {
  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border h-[600px]">
      <h3 className="text-lg font-semibold mb-4">Localização dos Equipamentos</h3>
      <div className="h-[calc(100%-3rem)] rounded-xl overflow-hidden">
        <MapContainer
          center={[-15.7801, -47.9292]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup>
            {mockMapPoints.map((point, idx) => (
              <Marker key={idx} position={[point.lat, point.lng]}>
                <Popup>
                  <div className="p-2">
                    <h4 className="font-semibold">{point.cidade} - {point.uf}</h4>
                    <p className="text-sm">Equipamentos: {point.qtd}</p>
                    <p className="text-sm">Litros: {formatNumber(point.litros)}</p>
                    <p className="text-sm">Status: {point.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
          <MapBounds />
        </MapContainer>
      </div>
    </Card>
  );
}
