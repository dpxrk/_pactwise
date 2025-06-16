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
    <div id="benefits" className="py-24 sm:py-32 bg-muted/50">
      <Container>
        <div className="mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary font-sans sm:text-4xl">
            Why Choose PactWise?
          </h2>
          <p className="mt-4 max-w-xl text-center text-muted-foreground">
            Discover how our platform transforms contract management and drives
            business value.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="font-sans">Key Benefits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="font-sans">Analytics & Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <TrendingUp className="h-8 w-8 text-gold" />
                <div>
                  <h4 className="font-semibold">Performance Metrics</h4>
                  <p className="text-sm text-muted-foreground">
                    Track savings, processing times, and efficiency improvements
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center space-x-4">
                <LineChart className="h-8 w-8 text-gold" />
                <div>
                  <h4 className="font-semibold">Insights Dashboard</h4>
                  <p className="text-sm text-muted-foreground">
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
