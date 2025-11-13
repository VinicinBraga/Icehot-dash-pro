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
      map.setView([lat, lng], 9);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [markers, map]);
  return null;
}

type CityMarker = {
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  totalEquip: number;
  ativos: number;
  inativos: number;
  litrosTotal: number;
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

  // Agrega por cidade/UF (usando lat/lng já resolvidos pelo backend)
  const cityMarkers: CityMarker[] = useMemo(() => {
    const map = new Map<string, CityMarker>();
    for (const p of points) {
      const cidade = p.cidade || "Sem cidade";
      const uf = p.uf || "";
      const key = `${cidade}/${uf}`;

      if (p.lat == null || p.lng == null) continue;

      if (!map.has(key)) {
        map.set(key, {
          cidade,
          uf,
          lat: Number(p.lat),
          lng: Number(p.lng),
          totalEquip: 0,
          ativos: 0,
          inativos: 0,
          litrosTotal: 0,
        });
      }
      const agg = map.get(key)!;
      agg.totalEquip += 1;
      agg.litrosTotal += Number(p.litros || 0);
      if ((p.status || "").toLowerCase() === "ativo") agg.ativos += 1;
      else agg.inativos += 1;
    }
    return Array.from(map.values());
  }, [points]);

  const center: [number, number] =
    cityMarkers.length > 0
      ? [cityMarkers[0].lat, cityMarkers[0].lng]
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

      {!loading && !error && cityMarkers.length === 0 && (
        <div className="h-[calc(100%-3rem)] flex items-center justify-center text-sm text-muted-foreground">
          Nenhuma localização encontrada para os filtros selecionados.
        </div>
      )}

      {!loading && !error && cityMarkers.length > 0 && (
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
              markers={cityMarkers.map((m) => ({ lat: m.lat, lng: m.lng }))}
            />

            {cityMarkers.map((m, i) => (
              <Marker
                key={`${m.cidade}-${m.uf}-${i}`}
                position={[m.lat, m.lng]}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold mb-1">
                      {m.cidade}
                      {m.uf ? `/${m.uf}` : ""}
                    </div>
                    <div>Total de equipamentos: {m.totalEquip}</div>
                    <div style={{ color: "#16a34a" }}>
                      Ativos no período: {m.ativos}
                    </div>
                    <div style={{ color: "#dc2626" }}>
                      Inativos no período: {m.inativos}
                    </div>
                    <div>
                      Litros no período: {formatLiters(m.litrosTotal)} L
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
