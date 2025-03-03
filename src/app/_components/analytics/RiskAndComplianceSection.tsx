import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DynamicChart from "@/app/_components/common/DynamicCharts"

const riskDistribution = [
  { name: "Low Risk", value: 45 },
  { name: "Medium Risk", value: 35 },
  { name: "High Risk", value: 20 },
];

const departmentPerformance = [
  { department: "Legal", efficiency: 92, contracts: 150, savings: 125000 },
  { department: "Sales", efficiency: 88, contracts: 200, savings: 180000 },
  { department: "Procurement", efficiency: 95, contracts: 180, savings: 150000 },
];

export const RiskAndComplianceSection = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
    <Card>
      <CardHeader>
        <CardTitle>Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <DynamicChart 
            type="pie"
            data={riskDistribution}
            series={[{ dataKey: "value" }]}
            pieConfig={{
              innerRadius: 60,
              outerRadius: 80,
              paddingAngle: 5,
              dataKey: "value",
              nameKey: "name",
            }}
            colors={["#4ade80", "#f87171", "#60a5fa"]}
            height={280}
            showLegend={true}
            showTooltip={true}
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Compliance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <DynamicChart 
            type="bar"
            data={departmentPerformance}
            series={[{
              dataKey: "efficiency",
              name: "Compliance Score",
              color: "#4ade80"
            }]}
            xAxisKey="department"
            height={280}
            showGrid={true}
            showLegend={true}
            showTooltip={true}
          />
        </div>
      </CardContent>
    </Card>
  </div>
);