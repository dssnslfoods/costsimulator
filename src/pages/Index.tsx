import Sidebar from '@/components/Sidebar';
import ExecutiveDashboard from '@/components/ExecutiveDashboard';
import ProductMaster from '@/components/ProductMaster';
import ProductGroupManager from '@/components/ProductGroupManager';
import ScenarioCreator from '@/components/ScenarioCreator';
import ScenarioComparison from '@/components/ScenarioComparison';
import CostAnalysis from '@/components/CostAnalysis';
import PriceSensitivity from '@/components/PriceSensitivity';
import Reports from '@/components/Reports';
import { useAppState } from '@/store/AppContext';

const Index = () => {
  const { state } = useAppState();

  const renderView = () => {
    switch (state.currentView) {
      case 'dashboard': return <ExecutiveDashboard />;
      case 'products': return <ProductMaster />;
      case 'product-groups': return <ProductGroupManager />;
      case 'scenario-creator': return <ScenarioCreator />;
      case 'scenario-comparison': return <ScenarioComparison />;
      case 'cost-analysis': return <CostAnalysis />;
      case 'price-sensitivity': return <PriceSensitivity />;
      case 'reports': return <Reports />;
      default: return <ExecutiveDashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto max-h-screen">
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
