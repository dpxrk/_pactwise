import { CheckCircle, TrendingUp, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Container } from "@/app/_components/common/Container";

const benefits = [
  "Reduce contract processing time by up to 80%",
  "Minimize risk with standardized templates and approval workflows",
  "Track and analyze contract metrics for better decision making",
  "Seamless external collaboration with secure sharing",
  "Automated compliance and audit trails",
];

export const Benefits = () => {
  return (
    <div id="benefits" className="py-24 sm:py-32 bg-gradient-to-b from-transparent via-teal-950/20 to-transparent relative">
      <Container>
        <div className="mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-white font-sans sm:text-4xl">
            Why Choose PactWise?
          </h2>
          <p className="mt-4 max-w-xl text-center text-gray-300">
            Discover how our platform transforms contract management and drives
            business value.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-cyan-950/40 border border-emerald-500/20 hover:shadow-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-sans text-white">Key Benefits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-gray-300">{benefit}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-950/40 via-cyan-950/30 to-emerald-950/40 border border-teal-500/20 hover:shadow-teal-500/20 hover:border-teal-400/40 transition-all duration-300 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-sans text-white">Analytics & Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <TrendingUp className="h-8 w-8 text-teal-400" />
                <div>
                  <h4 className="font-semibold text-white">Performance Metrics</h4>
                  <p className="text-sm text-gray-300">
                    Track savings, processing times, and efficiency improvements
                  </p>
                </div>
              </div>

              <Separator className="bg-teal-500/20" />

              <div className="flex items-center space-x-4">
                <LineChart className="h-8 w-8 text-cyan-400" />
                <div>
                  <h4 className="font-semibold text-white">Insights Dashboard</h4>
                  <p className="text-sm text-gray-300">
                    Real-time analytics and reporting for better decision making
                  </p>
                </div>
              </div>

              {/* <div className="mt-6 rounded-lg bg-muted p-6 text-center">
                [Analytics Dashboard Preview]
              </div> */}
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
};
