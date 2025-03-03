import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DynamicChart from "@/app/_components/common/DynamicCharts"
const contractTrends = [
  { month: "Jan", active: 45, completed: 30, expired: 5, value: 150000 },
  { month: "Feb", active: 52, completed: 35, expired: 3, value: 180000 },
  { month: "Mar", active: 48, completed: 40, expired: 4, value: 165000 },
  { month: "Apr", active: 60, completed: 38, expired: 6, value: 200000 },
];

export const ContractAnalyticsSection = () => (
  <div className="grid grid-cols-1 gap-4 mb-8">
    <Card>
      <CardHeader>
        <CardTitle>Contract Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <DynamicChart
            type="area"
            data={contractTrends}
            series={[
              {
                dataKey: "active",
                name: "Active",
                color: "#4ade80",
                stackId: "1",
                fillOpacity: 0.6
              },
              {
                dataKey: "completed",
                name: "Completed",
                color: "#60a5fa",
                stackId: "1",
                fillOpacity: 0.6
              },
              {
                dataKey: "expired",
                name: "Expired",
                color: "#f87171",
                stackId: "1",
                fillOpacity: 0.6
              }
            ]}
            xAxisKey="month"
            height={340}
            stacked={true}
            showGrid={true}
            showLegend={true}
            showTooltip={true}
          />
        </div>
      </CardContent>
    </Card>
  </div>
);