import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Product, Scenario, AppView, Promotion, ComparisonReport, DbTransaction } from '@/types';
import { supabase } from '@/lib/supabase';

interface AppState {
  products: Product[];
  scenarios: Scenario[];
  promotions: Promotion[];
  comparisonReports: ComparisonReport[];
  currentView: AppView;
  selectedScenarioIds: string[];
  editingScenarioId: string | null;
  tvMode: boolean;

  // Date Filtering
  allTransactions: Product[];
  availableDates: string[];
  selectedDate: string | null;
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
  | { type: 'EDIT_SCENARIO'; payload: string }
  | { type: 'CLEAR_EDITING' }
  | { type: 'ADD_PROMOTION'; payload: Promotion }
  | { type: 'UPDATE_PROMOTION'; payload: Promotion }
  | { type: 'DELETE_PROMOTION'; payload: string }
  | { type: 'ADD_COMPARISON_REPORT'; payload: ComparisonReport }
  | { type: 'DELETE_COMPARISON_REPORT'; payload: string }
  | { type: 'TOGGLE_TV_MODE' }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SET_SELECTED_DATE'; payload: string | null };

const initialState: AppState = {
  products: [],
  scenarios: [],
  promotions: [],
  comparisonReports: [],
  currentView: 'dashboard',
  selectedScenarioIds: [],
  editingScenarioId: null,
  tvMode: false,
  allTransactions: [],
  availableDates: [],
  selectedDate: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PRODUCTS': {
      // payload will be the full set of transactions. Let's extract unique dates
      const allTransactions = action.payload;
      const uniqueDates = Array.from(new Set(allTransactions.map(t => t.date).filter(Boolean))) as string[];
      // Sort dates descending (newest first)
      uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      let newSelectedDate = state.selectedDate;
      if (!newSelectedDate && uniqueDates.length > 0) {
        newSelectedDate = uniqueDates[0];
      }

      const filteredProducts = newSelectedDate
        ? allTransactions.filter(t => t.date === newSelectedDate)
        : allTransactions;

      return {
        ...state,
        allTransactions,
        availableDates: uniqueDates,
        selectedDate: newSelectedDate,
        products: filteredProducts
      };
    }
    case 'SET_SELECTED_DATE': {
      const selectedDate = action.payload;
      const filteredProducts = selectedDate
        ? state.allTransactions.filter(t => t.date === selectedDate)
        : state.allTransactions;
      return {
        ...state,
        selectedDate,
        products: filteredProducts
      };
    }
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
    case 'EDIT_SCENARIO':
      return { ...state, editingScenarioId: action.payload, currentView: 'scenario-creator' };
    case 'CLEAR_EDITING':
      return { ...state, editingScenarioId: null };
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
    case 'ADD_PROMOTION':
      return { ...state, promotions: [...state.promotions, action.payload] };
    case 'UPDATE_PROMOTION':
      return { ...state, promotions: state.promotions.map(g => g.id === action.payload.id ? action.payload : g) };
    case 'DELETE_PROMOTION':
      return { ...state, promotions: state.promotions.filter(g => g.id !== action.payload) };
    case 'ADD_COMPARISON_REPORT':
      return { ...state, comparisonReports: [...state.comparisonReports, action.payload] };
    case 'DELETE_COMPARISON_REPORT':
      return { ...state, comparisonReports: state.comparisonReports.filter(r => r.id !== action.payload) };
    case 'TOGGLE_TV_MODE':
      return { ...state, tvMode: !state.tvMode };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => { } });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('whatif-app-state');
      // Do not load "products" from localStorage anymore so it defaults to empty
      // and awaits the DB result.
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...init,
          scenarios: parsed.scenarios || [],
          promotions: parsed.promotions || [],
          comparisonReports: parsed.comparisonReports || []
        };
      }
    } catch { }
    return init;
  });

  // Fetch from database on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        let allData: any[] = [];
        let from = 0;
        let limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('transaction')
            .select('*')
            .order('date', { ascending: false })
            .range(from, from + limit - 1);

          if (error) {
             console.error("Error fetching transactions from DB", error);
             return;
          }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }

        if (allData.length > 0) {
          console.log(`Fetched ${allData.length} transactions from DB`);

          // Also fetch products_master to get item_group and item_country
          const { data: masterData } = await supabase
            .from('products_master')
            .select('item_id, item_group, item_country');
          const masterMap = new Map<string, { item_group?: string; item_country?: string }>();
          if (masterData) {
            masterData.forEach((m: any) => masterMap.set(m.item_id, { item_group: m.item_group, item_country: m.item_country }));
          }

          const dbTransactions: DbTransaction[] = allData;
          const loadedProducts: Product[] = dbTransactions.map(tx => {
            const master = masterMap.get(tx.item_id) || {};
            return {
              item_id: tx.item_id,
              item_name: tx.item_name || '',
              item_group: master.item_group,
              item_country: master.item_country,
              sale_volume: tx.sale_volume || 0,
              offer_price: tx.offer_price || 0,
              approved_cost: tx.approved_cost || 0,
              standard_cost: tx.standard_cost || 0,
              actual_cost: tx.actual_cost || 0,
              created_at: tx.date || new Date().toISOString(),
              date: tx.date
            };
          });
          dispatch({ type: 'SET_PRODUCTS', payload: loadedProducts });
        }
      } catch (err) {
        console.error("Unexpected error fetching", err);
      }
    };

    fetchProducts();
  }, []);

  // Sync remaining persistent states to local storage
  useEffect(() => {
    localStorage.setItem('whatif-app-state', JSON.stringify({
      scenarios: state.scenarios,
      promotions: state.promotions,
      comparisonReports: state.comparisonReports,
    }));
  }, [state.scenarios, state.promotions, state.comparisonReports]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppState = () => useContext(AppContext);
