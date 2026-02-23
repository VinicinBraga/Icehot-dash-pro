// src/components/MapView.tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatLiters } from "@/lib/format";
import type { Filters } from "@/lib/types";
import { apiFetch } from "@/lib/api";

type ApiPoint = {
  lat: number | null;
  lng: number | null;
  cidade: string;
  uf: string;
  qtd: number;
  litros: number;
  status: string;
  equipamento?: string;
};

type ApiResponse = {
  points: ApiPoint[];
  _period?: { from: string; to: string; email: string | null };
};

type Props = {
  dateRange: { from: Date; to: Date };
  filters: Filters;
};

// Ícone padrão Leaflet
delete (L as any).Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function AutoFitBounds({
  markers,
}: {
  markers: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;

    if (markers.length === 1) {
      const { lat, lng } = markers[0];
      map.setView([lat, lng], 12);
      return;
    }

    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [markers, map]);

  return null;
}

type EquipMarker = {
  key: string;
  lat: number;
  lng: number;
  cidade: string;
  uf: string;
  status: string;
  litros: number;
  equipamento: string;
};

export default function MapView({ dateRange, filters }: Props) {
  const [points, setPoints] = useState<ApiPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega pontos da API com o MESMO período/filtros e a MESMA auth do resto (apiFetch)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (dateRange?.from)
          params.set("from", dateRange.from.toISOString().slice(0, 10));
        if (dateRange?.to)
          params.set("to", dateRange.to.toISOString().slice(0, 10));

        if (filters?.usuario) params.set("usuario", String(filters.usuario));
        if (filters?.modelo) params.set("modelo", String(filters.modelo));
        if (filters?.equipamento)
          params.set("equipamento", String(filters.equipamento));
        if (filters?.serie) params.set("serie", String(filters.serie));
        if (filters?.status) params.set("status", String(filters.status));

        const res = await apiFetch(`/api/localizacao?${params.toString()}`);
        if (!res.ok)
          throw new Error(`Erro ao buscar localização: ${res.status}`);

        const data: ApiResponse = await res.json();
        setPoints(data.points || []);
      } catch (e: any) {
        console.error("Erro no MapView:", e);
        setError(e.message || "Erro ao carregar mapa");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [dateRange, filters]);

  // ✅ 1 marcador por equipamento (lat/lng já vem resolvido do backend):
  // - se tiver lat/lng do equipamento (observacao), usa
  // - se não tiver, backend cai no fallback da cidade (city_coords)
  const equipMarkers: EquipMarker[] = useMemo(() => {
    return (points || [])
      .filter((p) => p.lat != null && p.lng != null)
      .map((p, idx) => {
        const equipamento = p.equipamento || `EQP-${idx + 1}`;
        const cidade = p.cidade || "Sem cidade";
        const uf = p.uf || "";
        return {
          key: `${equipamento}-${idx}`,
          lat: Number(p.lat),
          lng: Number(p.lng),
          cidade,
          uf,
          status: p.status || "—",
          litros: Number(p.litros || 0),
          equipamento,
        };
      });
  }, [points]);

  const center: [number, number] =
    equipMarkers.length > 0
      ? [equipMarkers[0].lat, equipMarkers[0].lng]
      : [-14.235, -51.9253];

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border h-[600px]">
      <h3 className="text-lg font-semibold mb-4">Mapa de Localizações</h3>

      {loading && (
        <div className="h-[calc(100%-3rem)] flex items-center justify-center text-sm text-muted-foreground">
          Carregando mapa...
        </div>
      )}

      {error && !loading && (
        <div className="h-[calc(100%-3rem)] flex items-center justify-center text-sm text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && equipMarkers.length === 0 && (
        <div className="h-[calc(100%-3rem)] flex items-center justify-center text-sm text-muted-foreground">
          Nenhuma localização encontrada para os filtros selecionados.
        </div>
      )}

      {!loading && !error && equipMarkers.length > 0 && (
        <div className="h-[calc(100%-3rem)] rounded-xl overflow-hidden relative z-0">
          <MapContainer
            center={center}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <AutoFitBounds
              markers={equipMarkers.map((m) => ({ lat: m.lat, lng: m.lng }))}
            />

            {equipMarkers.map((m) => (
              <Marker key={m.key} position={[m.lat, m.lng]}>
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold mb-1">{m.equipamento}</div>

                    <div className="mb-1">
                      {m.cidade}
                      {m.uf ? `/${m.uf}` : ""}
                    </div>

                    <div>Status: {m.status}</div>

                    <div>
                      Litros no período: {formatLiters(m.litros)} L
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </Card>
  );
}