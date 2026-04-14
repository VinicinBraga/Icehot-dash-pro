// src/pages/Index.tsx
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { DateRangePicker } from "@/components/DateRangePicker";
import { FilterBar } from "@/components/FilterBar";
import { KpiCard } from "@/components/KpiCard";
import { WaterChart } from "@/components/WaterChart";
import { TriggerChart } from "@/components/TriggerChart";
import { ModelPieChart } from "@/components/ModelPieChart";
import { InstallationChart } from "@/components/InstallationChart";
import { CumulativeChart } from "@/components/CumulativeChart";
import { DataTable } from "@/components/DataTable";

import { useKpis } from "@/hooks/useKpis";
import { useWaterSeries, useTriggerSeries } from "@/hooks/useSeries";
import { useModelPie } from "@/hooks/useModels";
import { useWaterTable } from "@/hooks/useWaterTable";
import { useTriggerTable } from "@/hooks/useTriggerTable";
import { useFilters } from "@/hooks/useFilters";
import { useInstallationsSeries } from "@/hooks/useInstallationsSeries";
import { useCumulativeSeries } from "@/hooks/useCumulativeSeries";
import { useLocationKpis } from "@/hooks/useLocationKpis";
import { useLocationSummary } from "@/hooks/useLocationSummary";

import {
  Activity,
  BarChart3,
  Package,
  MapPin,
  Droplet,
  Snowflake,
  Flame,
  PawPrint,
  Milk,
  Cloud,
  Cog,
} from "lucide-react";

import {
  formatLiters,
  formatClicks,
  formatCO2,
  formatBottles,
} from "@/lib/format";
import type { Filters } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import "leaflet/dist/leaflet.css";
import { clearToken } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHotTemperatureTable } from "@/hooks/useHotTemperatureTable";
// Lazy load map to avoid SSR issues
const MapView = lazy(() => import("@/components/MapView"));

interface DateRange {
  from: Date;
  to: Date;
}

const Index = () => {
  // período padrão (últimos 30 dias)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // filtros
  const {
    data: filterOptions,
    loading: filtersLoading,
    error: filtersError,
  } = useFilters();
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState("overview");
  type EquipmentFilterItem = {
    value: number | string;
    label: string;
    installedAt?: string | null;
  };

  const selectedEquip = (
    filterOptions?.equipamentos as EquipmentFilterItem[] | undefined
  )?.find((e) => String(e.value) === String(filters?.equipamento));

  const installedBR = selectedEquip?.installedAt
    ? new Date(selectedEquip.installedAt + "T00:00:00").toLocaleDateString(
        "pt-BR"
      )
    : null;
  // ==== dados visão geral ====
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
  const hotTempTable = useHotTemperatureTable(dateRange.from, dateRange.to, filters);
  // ==== dados equipamentos ====
  const installations = useInstallationsSeries(dateRange, filters);
  const cumulative = useCumulativeSeries(dateRange, filters);

  // ==== dados localização ====
  const locationKpis = useLocationKpis(dateRange, filters);
  const locationSummary = useLocationSummary(dateRange, filters);

  // helper visão geral
  const val = (n?: number) => (kpisLoading || !kpis ? 0 : n ?? 0);

  const modules = kpis?.modules;

  // ✅ Normaliza módulos para o formato que os charts esperam
  // (se o backend mandar 0/1 ou boolean, a gente converte pra boolean)
  const asBool = (v: any, fallback = true) => {
    if (v === undefined || v === null) return fallback;
    if (v === true || v === 1 || v === "1") return true;
    if (v === false || v === 0 || v === "0") return false;
    return fallback;
  };

  // ⚠️ Aqui tratamos os dois formatos possíveis:
  // - antigo: { quente, pets, aspersor }
  // - novo: { agua_gelada, agua_quente, agua_pet, aspersor }
  const modulesForCharts = {
    fria: asBool((modules as any)?.fria ?? (modules as any)?.agua_gelada, true),
    quente: asBool(
      (modules as any)?.quente ?? (modules as any)?.agua_quente,
      true
    ),
    pets: asBool((modules as any)?.pets ?? (modules as any)?.agua_pet, true),
    aspersor: asBool((modules as any)?.aspersor, false), // default: não mostra se não vier
  };
  const modulesUI = modulesForCharts;
  useEffect(() => {
    console.log("KPI modules (raw) =>", kpis?.modules);
    console.log("modulesUI =>", modulesUI);
  }, [kpis, modulesUI]);
  // helper localização
  const valLoc = (n?: number) =>
    locationKpis.loading || !locationKpis.data ? 0 : n ?? 0;

  // ==== estado KPIs Equipamentos ====
  const [equipmentKpis, setEquipmentKpis] = useState({
    total_equipamentos: 0,
    ativos: 0,
    inativos: 0,
  });

  // ==== estado Tabela Equipamentos ====
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

  // ============================
  // ✅ BOOT LOADING (apenas no 1º load)
  // ============================
  const bootLoading = useMemo(() => {
    // “essencial” pra abrir sem mostrar 0:
    // - filtros (pra FilterBar já vir pronto)
    // - visão geral (kpis, charts e tabelas)
    return (
      filtersLoading ||
      kpisLoading ||
      water.loading ||
      trig.loading ||
      modelPie.loading ||
      waterTable.loading ||
      triggerTable.loading
    );
  }, [
    filtersLoading,
    kpisLoading,
    water.loading,
    trig.loading,
    modelPie.loading,
    waterTable.loading,
    triggerTable.loading,
  ]);

  const bootHasError = Boolean(filtersError || kpisError);

  // trava só na primeira vez; depois disso não “pisca” loader em toda troca de filtro
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    if (bootDone) return;
    // se terminou de carregar OU deu erro, liberamos a tela (pra exibir erro)
    if (!bootLoading || bootHasError) setBootDone(true);
  }, [bootDone, bootLoading, bootHasError]);

  // Carrega KPIs da aba Equipamentos
  useEffect(() => {
    if (activeTab !== "equipment") return;

    const params = new URLSearchParams();

    if (dateRange.from) {
      params.set("from", dateRange.from.toISOString().slice(0, 10));
    }
    if (dateRange.to) {
      params.set("to", dateRange.to.toISOString().slice(0, 10));
    }

    if (filters.usuario !== undefined && filters.usuario !== null) {
      params.set("usuario", String(filters.usuario));
    }
    if (filters.modelo !== undefined && filters.modelo !== null) {
      params.set("modelo", String(filters.modelo));
    }
    if (filters.equipamento !== undefined && filters.equipamento !== null) {
      params.set("equipamento", String(filters.equipamento));
    }
    if (filters.serie) {
      params.set("serie", String(filters.serie));
    }

    // 👇 aqui garantimos que "0" também entra
    if (
      filters.status !== undefined &&
      filters.status !== null &&
      filters.status !== ""
    ) {
      params.set("status", String(filters.status));
    }

    apiFetch(`/api/kpis/equipment?${params.toString()}`)
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

  // Carrega tabela da aba Equipamentos
  useEffect(() => {
    if (activeTab !== "equipment") return;

    setEquipmentTable((prev) => ({ ...prev, loading: true, error: null }));

    const params = new URLSearchParams();

    if (dateRange.from) {
      params.set("from", dateRange.from.toISOString().slice(0, 10));
    }
    if (dateRange.to) {
      params.set("to", dateRange.to.toISOString().slice(0, 10));
    }

    if (filters.usuario !== undefined && filters.usuario !== null) {
      params.set("usuario", String(filters.usuario));
    }
    if (filters.modelo !== undefined && filters.modelo !== null) {
      params.set("modelo", String(filters.modelo));
    }
    if (filters.equipamento !== undefined && filters.equipamento !== null) {
      params.set("equipamento", String(filters.equipamento));
    }
    if (filters.serie) {
      params.set("serie", String(filters.serie));
    }

    if (
      filters.status !== undefined &&
      filters.status !== null &&
      filters.status !== ""
    ) {
      params.set("status", String(filters.status));
    }

    apiFetch(`/api/tables/equipment-list?${params.toString()}`)
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

  // ✅ Se ainda não terminou o boot, mostra tela de carregamento
  if (!bootDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-6">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Carregando dados do dashboard...
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo + título */}
          <div
            className="flex items-center gap-4 md:gap-5 cursor-pointer"
            onClick={() => setActiveTab("overview")}
          >
            {/* Logo bem grande */}
            <div className="flex items-center">
              <img
                src="/Icehot_Logo_FundoBranco.png"
                alt="Icehot"
                className="h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-sm"
              />
            </div>

            {/* Texto ao lado da logo */}
            <div className="leading-tight">
              <div className="text-[11px] md:text-xs uppercase tracking-[0.25em] text-[#1105f2]">
                Icehot
              </div>
              <h1 className="text-xl md:text-3xl font-semibold text-foreground">
                Manager Dashboard
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Monitoramento em tempo real de consumo e equipamentos
              </p>
            </div>
          </div>

          {/* Período + logout */}
          <div className="flex items-center gap-4">
            {/* “Pílula” do período – mais comprida e alta */}
            <div
              className="
                hidden sm:flex items-center 
                rounded-full border border-border bg-background 
                px-5 py-2 
                min-w-[320px]
                text-sm
                justify-between
              "
            >
              <span className="mr-2 text-xs font-medium text-muted-foreground">
                Período:
              </span>

              <div className="flex-1">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            </div>

            {/* Mobile: simples, sem pílula grande */}
            <div className="sm:hidden">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            {/* Botão de logout cinza, mesma “grossura” e hover azul */}
            <Button
              type="button"
              variant="outline"
              className="
                h-[40px]
                rounded-full 
                px-5
                border-border 
                bg-muted 
                text-foreground
                hover:bg-[#1105f2] 
                hover:text-white 
                hover:border-[#1105f2]
                transition-all 
                flex items-center gap-2
              "
              onClick={() => {
                clearToken();
                window.location.href = "/";
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
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
          <div className="flex items-center gap-4">
            <TabsList className="grid w-full max-w-lg grid-cols-3 rounded-2xl h-14 p-1">
              <TabsTrigger
                value="overview"
                className="rounded-xl gap-2 h-12 text-base px-4"
              >
                <BarChart3 className="h-4 w-4" />
                Visão Geral
              </TabsTrigger>

              <TabsTrigger
                value="equipment"
                className="rounded-xl gap-2 h-12 text-base px-4"
              >
                <Package className="h-4 w-4" />
                Equipamentos
              </TabsTrigger>

              <TabsTrigger
                value="location"
                className="rounded-xl gap-2 h-12 text-base px-4"
              >
                <MapPin className="h-4 w-4" />
                Localização
              </TabsTrigger>
            </TabsList>

            {/* Info instalação (placeholder) */}
            {filters?.equipamento && (
              <div className="flex-1 rounded-xl border bg-white/60 px-4 py-2 text-sm text-muted-foreground h-14 flex items-center">
                Equipamento instalado desde o dia{" "}
                <b className="ml-1">{installedBR || "—"}</b>
              </div>
            )}
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {kpisError && (
              <Badge variant="destructive">
                Erro ao carregar KPIs: {String(kpisError)}
              </Badge>
            )}

            {/* Water KPIs */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              <KpiCard
                label="Total – Litros de Água"
                value={val(kpis?.water.total)}
                helpText="Volume total distribuído"
                suffix="L"
                formatter={formatLiters}
                icon={<Droplet />}
              />

              <KpiCard
                label="Água Fria"
                value={val(kpis?.water.fria)}
                helpText="Litros de água fria"
                suffix="L"
                formatter={formatLiters}
                icon={<Snowflake />}
              />

              {modulesUI.quente && (
                <KpiCard
                  label="Água Quente"
                  value={val(kpis?.water.quente)}
                  helpText="Litros de água quente"
                  suffix="L"
                  formatter={formatLiters}
                  icon={<Flame />}
                />
              )}

              {modulesUI.pets && (
                <KpiCard
                  label="Pets"
                  value={val(kpis?.water.pets)}
                  helpText="Litros para pets"
                  suffix="L"
                  formatter={formatLiters}
                  icon={<PawPrint />}
                />
              )}
            </div>

            {/* Trigger KPIs */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              <KpiCard
                label="Total – Acionamentos"
                value={val(kpis?.triggers.total)}
                helpText="Total de acionamentos"
                formatter={formatClicks}
                icon={<Activity />}
              />

              <KpiCard
                label="Acionamento – Fria"
                value={val(kpis?.triggers.fria)}
                helpText="Acionamentos água fria"
                formatter={formatClicks}
                icon={<Snowflake />}
              />

              {modulesUI.quente && (
                <KpiCard
                  label="Acionamento – Quente"
                  value={val(kpis?.triggers.quente)}
                  helpText="Acionamentos água quente"
                  formatter={formatClicks}
                  icon={<Flame />}
                />
              )}

              {modulesUI.pets && (
                <KpiCard
                  label="Acionamento – Pets"
                  value={val(kpis?.triggers.pets)}
                  helpText="Acionamentos pets"
                  formatter={formatClicks}
                  icon={<PawPrint />}
                />
              )}

              {modulesUI.aspersor && (
                <KpiCard
                  label="Acionamento – Aspersor"
                  value={val(kpis?.triggers.aspersor)}
                  helpText="Acionamentos do aspersor"
                  formatter={formatClicks}
                  icon={<Activity />}
                />
              )}
            </div>

            {/* Extras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Equipamentos Utilizados"
                value={val(kpis?.equipamentos_utilizados)}
                helpText="Equipamentos com registros no período"
                icon={<Cog />}
              />
              <KpiCard
                label="Garrafas Poupadas"
                value={val(kpis?.garrafas_poupadas)}
                helpText="Garrafas plásticas economizadas"
                formatter={formatBottles}
                icon={<Milk />}
              />
              <KpiCard
                label="CO₂ Poupado"
                value={val(kpis?.co2_poupado_kg)}
                suffix=" kg"
                helpText="Emissão de CO₂ evitada"
                formatter={formatCO2}
                icon={<Cloud />}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WaterChart
                data={water.data ?? undefined}
                modules={modulesForCharts}
              />
              <TriggerChart
                data={trig.data ?? undefined}
                modules={modulesForCharts}
              />
            </div>

            <ModelPieChart data={modelPie.data ?? undefined} />

            {/* Tables lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DataTable
                title="Litros x Equipamentos"
                columns={waterTable.data?.columns ?? []}
                rows={waterTable.data?.rows ?? []}
                total={waterTable.data?.total ?? 0}
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
            {/* Tabela de Temperatura (abaixo das duas) */}
            {(() => {
              const hasHot =
                hotTempTable?.data?.hot &&
                hotTempTable.data.hot.hidden !== true &&
                (hotTempTable.data.hot.rows ?? []).length > 0;

              const hasCold =
                hotTempTable?.data?.cold &&
                (hotTempTable.data.cold.rows ?? []).length > 0;

              if (!hasHot && !hasCold) return null;

              // 🔥 Se tiver quente → mostra as duas lado a lado
              if (hasHot) {
                return (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 🔥 Água Quente */}
                    <DataTable
                      title={
                        <div className="flex items-center gap-2 text-orange-500">
                          <Flame className="w-4 h-4" />
                          <span>Temperatura (Água Quente)</span>
                        </div>
                      }
                      columns={
                        hotTempTable.data.hot.columns ?? [
                          "Equipamento",
                          "Temperatura (°C)",
                          "Leitura",
                        ]
                      }
                      rows={hotTempTable.data.hot.rows ?? []}
                      total={hotTempTable.data.hot.total ?? 0}
                    />

                    {/* ❄️ Água Gelada */}
                    <DataTable
                      title={
                        <div className="flex items-center gap-2 text-blue-500">
                          <Snowflake className="w-4 h-4" />
                          <span>Temperatura (Água Gelada)</span>
                        </div>
                      }
                      columns={
                        hotTempTable.data.cold.columns ?? [
                          "Equipamento",
                          "Temperatura (°C)",
                          "Leitura",
                        ]
                      }
                      rows={hotTempTable.data.cold.rows ?? []}
                      total={hotTempTable.data.cold.total ?? 0}
                    />
                  </div>
                );
              }

              // ❄️ Se NÃO tiver quente → gelada ocupa tudo
              return (
                <div className="mt-6">
                  <DataTable
                    title={
                      <div className="flex items-center gap-2 text-blue-500">
                        <Snowflake className="w-4 h-4" />
                        <span>Temperatura (Água Gelada)</span>
                      </div>
                    }
                    columns={
                      hotTempTable.data.cold.columns ?? [
                        "Equipamento",
                        "Temperatura (°C)",
                        "Leitura",
                      ]
                    }
                    rows={hotTempTable.data.cold.rows ?? []}
                    total={hotTempTable.data.cold.total ?? 0}
                  />
                </div>
              );
            })()}
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
                helpText="Com uso no período selecionado"
              />
              <KpiCard
                label="Inativos"
                value={equipmentKpis.inativos}
                helpText="Sem uso no período selecionado"
              />
            </div>

            <DataTable
              title="Lista de Equipamentos"
              columns={
                equipmentTable.columns.length
                  ? equipmentTable.columns
                  : ["Equipamento", "Modelo", "Status", "Próx. troca filtro"]
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
            {locationKpis.error && (
              <Badge variant="destructive">
                Erro ao carregar KPIs de localização:{" "}
                {String(locationKpis.error)}
              </Badge>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Localizações"
                value={valLoc(locationKpis.data?.users_total)}
                helpText="Cidades com equipamentos filtrados"
              />
              <KpiCard
                label="Equipamentos Ativos"
                value={valLoc(locationKpis.data?.equipamentos_ativos)}
                helpText="Com registros no período selecionado"
              />
              <KpiCard
                label="Equipamentos Inativos"
                value={valLoc(locationKpis.data?.equipamentos_inativos)}
                helpText="Sem registros no período selecionado"
              />
            </div>

            <Suspense fallback={<Skeleton className="h-[400px] rounded-2xl" />}>
              <MapView dateRange={dateRange} filters={filters} />
            </Suspense>

            <DataTable
              title="Equipamentos por Localização"
              columns={
                locationSummary.data?.columns ?? [
                  "Localização",
                  "Total de Equipamentos",
                  "Ativos no período",
                  "Inativos no período",
                  "Litros no período",
                ]
              }
              rows={locationSummary.data?.rows ?? []}
              total={locationSummary.data?.total ?? 0}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
