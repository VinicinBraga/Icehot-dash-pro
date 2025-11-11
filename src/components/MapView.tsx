import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

interface LocationSummaryData {
  columns: string[];
  rows: (string | number)[][];
  total: number;
  points?: {
    name: string;
    lat?: number;
    lng?: number;
    total?: number;
    ativos?: number;
    inativos?: number;
  }[];
}

interface MapViewProps {
  data?: LocationSummaryData | null;
}

// Ícone customizado parecido com marker tradicional
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -30],
  shadowSize: [41, 41],
});

// Coordenadas básicas para algumas cidades comuns (fallback temporário)
const cityCoords: Record<string, { lat: number; lng: number }> = {
  Florianópolis: { lat: -27.5954, lng: -48.548 },
  "São Paulo": { lat: -23.5505, lng: -46.6333 },
  "Rio de Janeiro": { lat: -22.9068, lng: -43.1729 },
  Curitiba: { lat: -25.4284, lng: -49.2733 },
  "Porto Alegre": { lat: -30.0346, lng: -51.2177 },
  "Belo Horizonte": { lat: -19.9167, lng: -43.9345 },
};

function getCoordsFor(name: string) {
  const norm = name.trim();
  if (cityCoords[norm]) return cityCoords[norm];
  // centro aproximado do Brasil como fallback
  return { lat: -14.235, lng: -51.9253 };
}

const AutoFitBounds: React.FC<{ markers: { lat: number; lng: number }[] }> = ({
  markers,
}) => {
  const map = useMap();

  useMemo(() => {
    if (!markers.length) return;

    if (markers.length === 1) {
      const { lat, lng } = markers[0];
      map.setView([lat, lng], 6); // zoom mais aproximado no único ponto
      return;
    }

    const bounds = L.latLngBounds(markers.map((m) => L.latLng(m.lat, m.lng)));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [markers, map]);

  return null;
};

const MapView: React.FC<MapViewProps> = ({ data }) => {
  const locations =
    data?.rows?.map((row) => {
      const name = String(row[0] ?? "-");
      const total = Number(row[1] ?? 0);
      const ativos = Number(row[2] ?? 0);
      const inativos = Number(row[3] ?? 0);
      const coords = getCoordsFor(name);

      return {
        name,
        total,
        ativos,
        inativos,
        lat: coords.lat,
        lng: coords.lng,
      };
    }) ?? [];

  const markers = locations.map((l) => ({ lat: l.lat, lng: l.lng }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Mapa de Localizações</h3>

      {locations.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Nenhuma localização encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="h-64 w-full rounded-2xl overflow-hidden border border-border">
          <MapContainer
            center={markers[0] || { lat: -14.235, lng: -51.9253 }}
            zoom={4}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <AutoFitBounds markers={markers} />

            {locations.map((loc) => (
              <Marker
                key={loc.name}
                position={[loc.lat, loc.lng]}
                icon={markerIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold mb-1">{loc.name}</div>
                    <div>Total: {loc.total}</div>
                    <div style={{ color: "#16a34a" }}>Ativos: {loc.ativos}</div>
                    <div style={{ color: "#dc2626" }}>
                      Inativos: {loc.inativos}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {locations.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Use scroll para dar zoom e arraste para mover o mapa.
        </div>
      )}
    </Card>
  );
};

export default MapView;
