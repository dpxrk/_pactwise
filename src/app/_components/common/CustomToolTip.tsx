import { TooltipProps } from "recharts";

interface CustomPayload {
  color: string;
  name: string;
  value: number;
  payload?: {
    [key: string]: string | number | boolean | null | undefined;
  };
}

interface CustomTooltipProps
  extends Omit<TooltipProps<number, string>, "payload"> {
  payload?: CustomPayload[];
  valuePrefix?: string;
  valueSuffix?: string;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  valuePrefix = "",
  valueSuffix = "",
}) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-background p-4 border border-border rounded-lg shadow-lg">
      <p className="text-sm font-medium text-primary">{label}</p>
      {payload.map((pld, index) => (
        <p key={index} className="text-sm" style={{ color: pld.color }}>
          {pld.name}: {valuePrefix}
          {pld.value.toLocaleString()}
          {valueSuffix}
        </p>
      ))}
    </div>
  );
};

export default CustomTooltip;
