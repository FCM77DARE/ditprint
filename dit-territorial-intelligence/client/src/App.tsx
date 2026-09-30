import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Sistema from "./pages/Sistema";
import DashboardLogin from "./pages/DashboardLogin";

// Área pública
import PublicoInicio from "./pages/publico/Inicio";
import PublicoDiagnostico from "./pages/publico/Diagnostico";
import PublicoRadar from "./pages/publico/Radar";
import PublicoMetodologia from "./pages/publico/Metodologia";
import PublicoTerritorio from "./pages/publico/Territorio";
import PublicoEntrar from "./pages/publico/Entrar";

// Portal do assinante
import PortalHoje from "./pages/portal/Hoje";
import PortalTerritorio from "./pages/portal/Territorio";
import PortalAlertas from "./pages/portal/Alertas";
import PortalConta from "./pages/portal/Conta";

// Mesa do operador PRINT
import MesaResumo from "./pages/mesa/Resumo";
import MesaPublicacao from "./pages/mesa/Publicacao";
import MesaFontes from "./pages/mesa/Fontes";
import MesaSinais from "./pages/mesa/Sinais";
import MesaTerritorios from "./pages/mesa/Territorios";
import MesaAnalise from "./pages/mesa/Analise";
import MesaAssinantes from "./pages/mesa/Assinantes";

function Router() {
  return (
    <Switch>
      {/* Pública */}
      <Route path="/" component={PublicoInicio} />
      <Route path="/diagnostico" component={PublicoDiagnostico} />
      <Route path="/radar" component={PublicoRadar} />
      <Route path="/metodologia" component={PublicoMetodologia} />
      <Route path="/territorio/:slug" component={PublicoTerritorio} />
      <Route path="/entrar" component={PublicoEntrar} />

      {/* Portal */}
      <Route path="/portal" component={PortalHoje} />
      <Route path="/portal/territorio/:slug" component={PortalTerritorio} />
      <Route path="/portal/alertas" component={PortalAlertas} />
      <Route path="/portal/conta" component={PortalConta} />

      {/* Mesa */}
      <Route path="/mesa/login" component={DashboardLogin} />
      <Route path="/mesa" component={MesaResumo} />
      <Route path="/mesa/publicacao" component={MesaPublicacao} />
      <Route path="/mesa/fontes" component={MesaFontes} />
      <Route path="/mesa/sinais" component={MesaSinais} />
      <Route path="/mesa/territorios" component={MesaTerritorios} />
      <Route path="/mesa/analise/:slug" component={MesaAnalise} />
      <Route path="/mesa/assinantes" component={MesaAssinantes} />

      {/* Interno */}
      <Route path="/sistema" component={Sistema} />

      {/* Rotas antigas */}
      <Route path="/dashboard/login">{() => <Redirect to="/mesa/login" />}</Route>
      <Route path="/dashboard/dit/:slug">
        {(p: { slug: string }) => <Redirect to={`/mesa/analise/${p.slug}`} />}
      </Route>
      <Route path="/dashboard">{() => <Redirect to="/mesa" />}</Route>
      <Route path="/portal/configuracoes">{() => <Redirect to="/portal/conta" />}</Route>
      <Route path="/sse">{() => <Redirect to="/diagnostico" />}</Route>
      <Route path="/dev">{() => <Redirect to="/mesa" />}</Route>
      <Route path="/sobre">{() => <Redirect to="/metodologia" />}</Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
