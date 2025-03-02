import {redirect} from 'next/navigation'

type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
}

const sizeClasses: Record<LogoSize, { text: string; dot: string }> = {
  sm: {
    text: "text-xl",
    dot: "h-1.5 w-1.5",
  },
  md: {
    text: "text-2xl",
    dot: "h-2 w-2",
  },
  lg: {
    text: "text-3xl",
    dot: "h-2.5 w-2.5",
  },
  xl: {
    text: "text-4xl",
    dot: "h-3 w-3",
  },
};

export const Logo = ({ size = "md" }: LogoProps) => {
 
  const sizeClass = sizeClasses[size];

  const handleOnClick = () => {
    redirect("/");
  };

  return (
    <div
      className="inline-flex items-center gap-1 cursor-pointer"
      onClick={handleOnClick}
    >
      <span className={`font-serif font-bold ${sizeClass.text}`}>
        <span className="bg-gradient-to-r from-navy via-gold to-navy bg-clip-text text-transparent animate-gradient">
          Pact
        </span>
        <span className="bg-gradient-to-r from-gold via-navy to-gold bg-clip-text text-transparent animate-gradient">
          Wise
        </span>
      </span>

      <div className={`rounded-full bg-gold animate-pulse ${sizeClass.dot}`} />
    </div>
  );
};
