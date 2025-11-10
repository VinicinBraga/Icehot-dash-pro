// src/pages/Index.tsx
import { useState, useEffect, lazy, Suspense } from "react";
import { subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Package, MapPin } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { FilterBar } from "@/components/FilterBar";
import { KpiCard } from "@/components/KpiCard";
import { WaterChart } from "@/components/WaterChart";
import { TriggerChart } from "@/components/TriggerChart";
import { ModelPieChart } from "@/components/ModelPieChart";
import { InstallationChart } from "@/components/InstallationChart";
import { CumulativeChart } from "@/components/CumulativeChart";
import { DataTable } from "@/components/DataTable";
import { mockTableWater, mockLocationTable } from "@/lib/mockData";
import { useInstallationsSeries } from "@/hooks/useInstallationsSeries";
import { useCumulativeSeries } from "@/hooks/useCumulativeSeries";
import { useKpis } from "@/hooks/useKpis";
import { useWaterSeries, useTriggerSeries } from "@/hooks/useSeries";
import { useModelPie } from "@/hooks/useModels";
import { useWaterTable } from "@/hooks/useWaterTable";
import { useFilters } from "@/hooks/useFilters";
import { useTriggerTable } from "@/hooks/useTriggerTable";
import {
  formatLiters,
  formatClicks,
  formatCO2,
  formatBottles,
} from "@/lib/format";
import type { Filters } from "@/lib/types"; // 👈 usamos o tipo centralizado

interface DateRange {
  from: Date;
  to: Date;
}

// Lazy load map to avoid SSR issues
const MapView = lazy(() => import("@/components/MapView"));

const Index = () => {
  // período padrão (últimos 30 dias)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // opções dos selects (vem do backend)
  const {
    data: filterOptions,
    loading: filtersLoading,
    error: filtersError,
  } = useFilters();

  // estado dos filtros selecionados
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState("overview");

  // ==== chamadas de dados (agora TODAS recebem os filtros) ====
  const {
    data: kpis,
    loading: kpisLoading,
    error: kpisError,
  } = useKpis(dateRange, filters);

  const water = useWaterSeries(dateRange, filters);
  const trig = useTriggerSeries(dateRange, filters);
  const modelPie = useModelPie(dateRange, filters);
  const waterTable = useWaterTable(dateRange, filters);
  const triggerTable = useTriggerTable(dateRange, filters);
  const installations = useInstallationsSeries(dateRange, filters);
  const cumulative = useCumulativeSeries(dateRange, filters);
  // helper: valor com fallback durante loading
  const val = (n?: number) => (kpisLoading || !kpis ? 0 : n ?? 0);

  const [equipmentKpis, setEquipmentKpis] = useState({
    total_equipamentos: 0,
    ativos: 0,
    inativos: 0,
  });

  const [equipmentTable, setEquipmentTable] = useState<{
    columns: string[];
    rows: (string | number)[][];
    total: number;
    loading: boolean;
    error: string | null;
  }>({
    columns: [],
    rows: [],
    total: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (activeTab !== "equipment") return;

    const params = new URLSearchParams();

    // período
    if (dateRange.from)
      params.set("from", dateRange.from.toISOString().slice(0, 10));
    if (dateRange.to) params.set("to", dateRange.to.toISOString().slice(0, 10));

    // filtros
    if (filters.usuario) params.set("usuario", String(filters.usuario));
    if (filters.modelo) params.set("modelo", String(filters.modelo));
    if (filters.equipamento)
      params.set("equipamento", String(filters.equipamento));
    if (filters.serie) params.set("serie", String(filters.serie));
    if (filters.status) params.set("status", String(filters.status));

    fetch(`/api/kpis/equipment?${params.toString()}`, {
      headers: {
        // enquanto não integrou auth real, fixa um usuário com dados
        "x-user-email": "acquareduz@icehot.net.br",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setEquipmentKpis({
          total_equipamentos: data.total_equipamentos ?? 0,
          ativos: data.ativos ?? 0,
          inativos: data.inativos ?? 0,
        });
      })
      .catch((err) => {
        console.error("Erro ao carregar KPIs de equipamentos:", err);
        setEquipmentKpis({
          total_equipamentos: 0,
          ativos: 0,
          inativos: 0,
        });
      });
  }, [activeTab, dateRange, filters]);

  useEffect(() => {
    if (activeTab !== "equipment") return;

    setEquipmentTable((prev) => ({ ...prev, loading: true, error: null }));

    const params = new URLSearchParams();

    // período
    if (dateRange.from)
      params.set("from", dateRange.from.toISOString().slice(0, 10));
    if (dateRange.to) params.set("to", dateRange.to.toISOString().slice(0, 10));

    // filtros
    if (filters.usuario) params.set("usuario", String(filters.usuario));
    if (filters.modelo) params.set("modelo", String(filters.modelo));
    if (filters.equipamento)
      params.set("equipamento", String(filters.equipamento));
    if (filters.serie) params.set("serie", String(filters.serie));
    if (filters.status) params.set("status", String(filters.status));

    fetch(`/api/tables/equipment-list?${params.toString()}`, {
      headers: {
        // temporário até ter auth real
        "x-user-email": "acquareduz@icehot.net.br",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setEquipmentTable({
          columns: data.columns ?? [],
          rows: data.rows ?? [],
          total: data.total ?? 0,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        console.error("Erro ao carregar tabela de equipamentos:", err);
        setEquipmentTable((prev) => ({
          ...prev,
          loading: false,
          error: "Erro ao carregar dados",
        }));
      });
  }, [activeTab, dateRange, filters]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                IH
              </span>
            </div>
            <h1 className="text-2xl font-bold">Icehot Dashboard</h1>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          options={filterOptions ?? undefined}
          loading={filtersLoading}
          error={filtersError ?? null}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3 rounded-2xl">
            <TabsTrigger value="overview" className="rounded-xl gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="equipment" className="rounded-xl gap-2">
              <Package className="h-4 w-4" />
              Equipamentos
            </TabsTrigger>
            <TabsTrigger value="location" className="rounded-xl gap-2">
              <MapPin className="h-4 w-4" />
              Localização
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {kpisError && (
              <Badge variant="destructive">
                Erro ao carregar KPIs: {String(kpisError)}
              </Badge>
            )}

            {/* Water KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total – Litros de Água"
                value={val(kpis?.water.total)}
                helpText="Volume total distribuído"
                suffix="L"
                formatter={formatLiters}
              />
              <KpiCard
                label="Água Fria"
                value={val(kpis?.water.fria)}
                helpText="Litros de água fria"
                suffix="L"
                formatter={formatLiters}
              />
              <KpiCard
                label="Água Quente"
                value={val(kpis?.water.quente)}
                helpText="Litros de água quente"
                suffix="L"
                formatter={formatLiters}
              />
              <KpiCard
                label="Pets"
                value={val(kpis?.water.pets)}
                helpText="Litros para pets"
                suffix="L"
                formatter={formatLiters}
              />
            </div>

            {/* Trigger KPIs (cliques) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total – Acionamentos"
                value={val(kpis?.triggers.total)}
                helpText="Total de acionamentos"
                formatter={formatClicks}
              />
              <KpiCard
                label="Acionamento – Fria"
                value={val(kpis?.triggers.fria)}
                helpText="Acionamentos água fria"
                formatter={formatClicks}
              />
              <KpiCard
                label="Acionamento – Quente"
                value={val(kpis?.triggers.quente)}
                helpText="Acionamentos água quente"
                formatter={formatClicks}
              />
              <KpiCard
                label="Acionamento – Pets"
                value={val(kpis?.triggers.pets)}
                helpText="Acionamentos pets"
                formatter={formatClicks}
              />
            </div>

            {/* Extras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Equipamentos Utilizados"
                value={val(kpis?.equipamentos_utilizados)}
                helpText="Equipamentos ativos no período"
              />
              <KpiCard
                label="Garrafas Poupadas"
                value={val(kpis?.garrafas_poupadas)}
                helpText="Garrafas plásticas economizadas"
                formatter={formatBottles}
              />
              <KpiCard
                label="CO₂ Poupado"
                value={val(kpis?.co2_poupado_m3)}
                suffix=" m³"
                helpText="Emissão de CO₂ evitada"
                formatter={formatCO2}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WaterChart data={water.data ?? undefined} />
              <TriggerChart data={trig.data ?? undefined} />
            </div>

            <ModelPieChart data={modelPie.data ?? undefined} />

            {/* Tables */}
            <div className="space-y-6">
              <DataTable
                title="Litros x Equipamentos"
                columns={waterTable.data?.columns ?? mockTableWater.columns}
                rows={waterTable.data?.rows ?? mockTableWater.rows}
                total={waterTable.data?.total ?? mockTableWater.total}
              />
              <DataTable
                title="Utilização x Equipamentos"
                columns={
                  triggerTable.data?.columns ?? ["Equipamento", "Acionamentos"]
                }
                rows={triggerTable.data?.rows ?? []}
                total={triggerTable.data?.total ?? 0}
              />
            </div>
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Total de Equipamentos"
                value={equipmentKpis.total_equipamentos}
                helpText="Total de equipamentos filtrados"
              />
              <KpiCard
                label="Ativos"
                value={equipmentKpis.ativos}
                helpText="Equipamentos com uso no período selecionado"
              />
              <KpiCard
                label="Inativos"
                value={equipmentKpis.inativos}
                helpText="Sem registros no período selecionado"
              />
            </div>

            <DataTable
              title="Lista de Equipamentos"
              columns={
                equipmentTable.columns.length
                  ? equipmentTable.columns
                  : [
                      "Equipamento",
                      "Modelo",
                      "Nº de Série",
                      "Status",
                      "Ativo no período?",
                    ]
              }
              rows={equipmentTable.rows}
              total={equipmentTable.total}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InstallationChart data={installations.data ?? undefined} />
              <CumulativeChart data={cumulative.data ?? undefined} />
            </div>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Usuários"
                value={87}
                helpText="Total de usuários cadastrados"
              />
              <KpiCard
                label="Ativos"
                value={365}
                helpText="Equipamentos ativos"
              />
              <KpiCard
                label="Inativos"
                value={33}
                helpText="Equipamentos inativos"
              />
            </div>

            <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
              <MapView />
            </Suspense>

            <DataTable
              title="Equipamentos por Localização"
              columns={mockLocationTable.columns}
              rows={mockLocationTable.rows}
              total={mockLocationTable.total}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
