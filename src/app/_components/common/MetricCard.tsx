import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ChevronUp, ChevronDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  description?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  title,
  value,
  icon: Icon,
  trend,
  description,
  changeType = "neutral",
}) => (
  <Card className="bg-background-glass backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 ease-out cursor-pointer group">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {React.createElement(Icon, {
        className: "h-4 w-4 text-primary group-hover:scale-110 transition-transform duration-200 ease-out"
      })}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {trend && (
        <p
          className={`text-xs mt-1 flex items-center ${
            changeType === "positive"
              ? "text-success"
              : changeType === "negative"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {changeType === "positive" ? (
            <ChevronUp className="h-4 w-4" />
          ) : changeType === "negative" ? (
            <ChevronDown className="h-4 w-4" />
          ) : null}
          {Math.abs(trend)}% from previous period
        </p>
      )}
      {description && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
    </CardContent>
  </Card>
));
