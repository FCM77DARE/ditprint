import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LandingSimple from "./pages/LandingSimple";
import SSE from "./pages/SSE";
import TerritoryDetail from "./pages/TerritoryDetail";
import Methodology from "./pages/Methodology";
import RadarTerritorial from "./pages/RadarTerritorial";
import Dashboard from "./pages/Dashboard";
import DashboardLogin from "./pages/DashboardLogin";
import DITCommandCenter from "./pages/DITCommandCenter";
import RadarPortal from "./pages/RadarPortal";
import RadarTerritoryPage from "./pages/RadarTerritoryPage";
import RadarAlertas from "./pages/RadarAlertas";
import RadarConfiguracoes from "./pages/RadarConfiguracoes";
import DevHub from "./pages/DevHub";

function Router() {
  return (
    <Switch>
      <Route path={"/dev"} component={DevHub} />
      <Route path={"/"} component={LandingSimple} />
      <Route path={"/sse"} component={SSE} />
      <Route path={"/metodologia"} component={Methodology} />
      {/* Unified territory route — handles all slugs */}
      <Route path={"/territorio/:slug"} component={TerritoryDetail} />
      {/* Legacy radar landing */}
      <Route path={"/radar"} component={RadarTerritorial} />
      {/* Subscriber portal */}
      <Route path={"/portal"} component={RadarPortal} />
      <Route path={"/portal/territorio/:slug"} component={RadarTerritoryPage} />
      <Route path={"/portal/alertas"} component={RadarAlertas} />
      <Route path={"/portal/configuracoes"} component={RadarConfiguracoes} />
      {/* Dashboard */}
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/dashboard/dit/:slug"} component={DITCommandCenter} />
      <Route path={"/dashboard/login"} component={DashboardLogin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
