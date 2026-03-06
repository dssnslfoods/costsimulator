import { Monitor, MonitorOff } from 'lucide-react';
import { useAppState } from '@/store/AppContext';
import { Button } from '@/components/ui/button';

export default function TvModeToggle() {
  const { state, dispatch } = useAppState();

  return (
    <Button
      variant={state.tvMode ? 'default' : 'outline'}
      size="sm"
      onClick={() => dispatch({ type: 'TOGGLE_TV_MODE' })}
      className="gap-2"
      title={state.tvMode ? 'Exit TV Mode' : 'Enter TV Mode'}
    >
      {state.tvMode ? <MonitorOff size={16} /> : <Monitor size={16} />}
      {state.tvMode ? 'Exit TV' : 'TV Mode'}
    </Button>
  );
}
