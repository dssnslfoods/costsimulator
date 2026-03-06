import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Product, Scenario, AppView } from '@/types';

interface AppState {
  products: Product[];
  scenarios: Scenario[];
  currentView: AppView;
  selectedScenarioIds: string[];
}

type Action =
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_SCENARIO'; payload: Scenario }
  | { type: 'UPDATE_SCENARIO'; payload: Scenario }
  | { type: 'DELETE_SCENARIO'; payload: string }
  | { type: 'DUPLICATE_SCENARIO'; payload: { id: string; newId: string; newName: string } }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'TOGGLE_SCENARIO_SELECTION'; payload: string }
  | { type: 'SET_SELECTED_SCENARIOS'; payload: string[] }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

const initialState: AppState = {
  products: [],
  scenarios: [],
  currentView: 'dashboard',
  selectedScenarioIds: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'ADD_SCENARIO':
      return { ...state, scenarios: [...state.scenarios, action.payload] };
    case 'UPDATE_SCENARIO':
      return {
        ...state,
        scenarios: state.scenarios.map(s => s.id === action.payload.id ? action.payload : s),
      };
    case 'DELETE_SCENARIO':
      return {
        ...state,
        scenarios: state.scenarios.filter(s => s.id !== action.payload),
        selectedScenarioIds: state.selectedScenarioIds.filter(id => id !== action.payload),
      };
    case 'DUPLICATE_SCENARIO': {
      const source = state.scenarios.find(s => s.id === action.payload.id);
      if (!source) return state;
      const dup: Scenario = {
        ...source,
        id: action.payload.newId,
        name: action.payload.newName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { ...state, scenarios: [...state.scenarios, dup] };
    }
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'TOGGLE_SCENARIO_SELECTION': {
      const exists = state.selectedScenarioIds.includes(action.payload);
      return {
        ...state,
        selectedScenarioIds: exists
          ? state.selectedScenarioIds.filter(id => id !== action.payload)
          : [...state.selectedScenarioIds, action.payload],
      };
    }
    case 'SET_SELECTED_SCENARIOS':
      return { ...state, selectedScenarioIds: action.payload };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => {} });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('whatif-app-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...init, products: parsed.products || [], scenarios: parsed.scenarios || [] };
      }
    } catch {}
    return init;
  });

  useEffect(() => {
    localStorage.setItem('whatif-app-state', JSON.stringify({
      products: state.products,
      scenarios: state.scenarios,
    }));
  }, [state.products, state.scenarios]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppState = () => useContext(AppContext);
