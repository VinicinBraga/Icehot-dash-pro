import { useState, lazy, Suspense } from "react";
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
import { mockKpis, mockTableWater, mockTableUsage, mockEquipmentTable, mockLocationTable } from "@/lib/mockData";

// Lazy load map to avoid SSR issues
const MapView = lazy(() => import("@/components/MapView"));

interface DateRange {
  from: Date;
  to: Date;
}

interface Filters {
  usuario?: number;
  modelo?: number;
  equipamento?: number;
  serie?: string;
  status?: string;
}

const Index = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">IH</span>
            </div>
            <h1 className="text-2xl font-bold">Icehot Dashboard</h1>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} />

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
            {/* Water KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total – Litros de Água"
                value={mockKpis.water.total}
                helpText="Volume total distribuído"
              />
              <KpiCard
                label="Água Fria"
                value={mockKpis.water.fria}
                helpText="Litros de água fria"
              />
              <KpiCard
                label="Água Quente"
                value={mockKpis.water.quente}
                helpText="Litros de água quente"
              />
              <KpiCard
                label="Pets"
                value={mockKpis.water.pets}
                helpText="Litros para pets"
              />
            </div>

            {/* Trigger KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total – Acionamentos"
                value={mockKpis.triggers.total}
                helpText="Total de acionamentos"
              />
              <KpiCard
                label="Acionamento – Fria"
                value={mockKpis.triggers.fria}
                helpText="Acionamentos água fria"
              />
              <KpiCard
                label="Acionamento – Quente"
                value={mockKpis.triggers.quente}
                helpText="Acionamentos água quente"
              />
              <KpiCard
                label="Acionamento – Pets"
                value={mockKpis.triggers.pets}
                helpText="Acionamentos pets"
              />
            </div>

            {/* Additional KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Equipamentos Utilizados"
                value={mockKpis.equipamentos_utilizados}
                helpText="Equipamentos ativos no período"
              />
              <KpiCard
                label="Garrafas Poupadas"
                value={mockKpis.garrafas_poupadas}
                helpText="Garrafas plásticas economizadas"
              />
              <KpiCard
                label="CO₂ Poupado"
                value={mockKpis.co2_poupado_m3}
                suffix="m³"
                helpText="Emissão de CO₂ evitada"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WaterChart />
              <TriggerChart />
            </div>

            <ModelPieChart />

            {/* Tables */}
            <div className="space-y-6">
              <DataTable
                title="Litros x Equipamentos"
                columns={mockTableWater.columns}
                rows={mockTableWater.rows}
                total={mockTableWater.total}
              />
              <DataTable
                title="Utilização x Equipamentos"
                columns={mockTableUsage.columns}
                rows={mockTableUsage.rows}
                total={mockTableUsage.total}
              />
            </div>
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                label="Total de Equipamentos"
                value={398}
                helpText="Total de equipamentos cadastrados"
              />
              <KpiCard
                label="Ativos"
                value={365}
                helpText="Equipamentos em operação"
              />
              <KpiCard
                label="Inativos"
                value={33}
                helpText="Equipamentos desativados"
              />
            </div>

            <DataTable
              title="Lista de Equipamentos"
              columns={mockEquipmentTable.columns}
              rows={mockEquipmentTable.rows}
              total={mockEquipmentTable.total}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InstallationChart />
              <CumulativeChart />
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
