 import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Leaf, 
  Trash2, 
  TrendingUp,
  Utensils,
  Search,
  History,
  Check,
  Hash,
  ArrowLeft,
  ChefHat,
  Sparkles,
  Loader2,
  Cpu,
  Keyboard,
  Calendar as CalendarIcon,
  HelpCircle,
  Code2,
  Menu,
  X,
  Coffee,
  ChevronLeft,
  AlertCircle,
  Database
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * Configuration Resolver
 * This function safely resolves configuration settings to avoid crashes in 
 * environments where 'import.meta' or specific global variables are unavailable.
 */
const resolveGlobalConfig = () => {
  const config = {
    firebase: {},
    appId: 'chart-your-food',
    geminiKey: ''
  };

  // 1. Attempt to resolve from Canvas/Sandbox globals
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
      config.firebase = JSON.parse(__firebase_config);
      config.appId = typeof __app_id !== 'undefined' ? __app_id : 'chart-your-food';
    } catch (e) {
      console.error("Global config parse error", e);
    }
  } 
  // 2. Attempt to resolve from Vite environment variables (Production/Local)
  else {
    try {
      // Direct property access is required for Vite's static replacement during production builds
      config.firebase = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
      config.appId = import.meta.env.VITE_APP_ID || 'chart-your-food';
      config.geminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    } catch (e) {
      // Fallback for non-Vite or isolated environments
    }
  }

  // CRITICAL FIX: Sanitize appId. Firebase paths break if appId contains slashes (making segments even).
  config.appId = String(config.appId).replace(/\//g, '_');
  
  return config;
};

const appConfig = resolveGlobalConfig();
const app = initializeApp(appConfig.firebase);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = appConfig.appId;

// --- Shared Design Tokens ---
const synchronizedLabelStyle = "text-sm font-medium text-emerald-800 uppercase tracking-[0.25em]";
const standardInputStyle = "w-full px-5 py-3 bg-stone-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-stone-300";
const miniLabelStyle = "text-[10px] font-medium text-emerald-800 uppercase tracking-[0.15em] mb-1.5 ml-1 block";
const tooltipStyle = "absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[110] w-48 p-2.5 bg-stone-800 text-white text-[10px] leading-tight rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none text-center font-medium";

// --- Custom Logo Component ---
const LogoIcon = () => (
  <svg 
    width="40" 
    height="40" 
    viewBox="0 0 40 40" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))' }}
    className="transition-transform hover:scale-105"
  >
    <rect x="2" y="2" width="36" height="36" rx="8" fill="white" stroke="#10B981" strokeWidth="2"/>
    <line x1="14" y1="2" x2="14" y2="38" stroke="#D1FAE5" strokeWidth="1"/>
    <line x1="26" y1="2" x2="26" y2="38" stroke="#D1FAE5" strokeWidth="1"/>
    <line x1="2" y1="14" x2="38" y2="14" stroke="#D1FAE5" strokeWidth="1"/>
    <line x1="2" y1="26" x2="38" y2="26" stroke="#D1FAE5" strokeWidth="1"/>
    <circle cx="8" cy="8" r="3" fill="#10B981"/>
    <circle cx="20" cy="8" r="3" fill="#F59E0B"/>
    <circle cx="32" cy="8" r="3" fill="#3B82F6"/>
    <circle cx="8" cy="20" r="3" fill="#EF4444"/>
    <circle cx="20" cy="20" r="3" fill="#8B5CF6"/>
    <circle cx="32" cy="20" r="3" fill="#EC4899"/>
    <circle cx="8" cy="32" r="3" fill="#14B8A6"/>
    <circle cx="20" cy="32" r="3" fill="#F97316"/>
    <circle cx="32" cy="32" r="3" fill="#06B6D4"/>
  </svg>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('main'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [entries, setEntries] = useState([]);
  const [foodLibrary, setFoodLibrary] = useState([]); 
  const [savedMeals, setSavedMeals] = useState([]);
  const [viewMode, setViewMode] = useState('today'); 
  const [selectedDate, setSelectedDate] = useState(null); 
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMealAiLoading, setIsMealAiLoading] = useState(false);

  const [mainAiError, setMainAiError] = useState("");
  const [mealAiError, setMealAiError] = useState("");

  const [showMainTooltip, setShowMainTooltip] = useState(false);
  const [showMealTooltip, setShowMealTooltip] = useState(false);
  const mainTooltipTimer = useRef(null);
  const mealTooltipTimer = useRef(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showComponentSuggestions, setShowComponentSuggestions] = useState(false);
  
  const suggestionRef = useRef(null);
  const componentSuggestionRef = useRef(null);
  const menuRef = useRef(null);

  // Keyboard Navigation Refs
  const mainInputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const mealInputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
    servings: '1',
    icon: '🍽️'
  });

  const [mealDraft, setMealDraft] = useState({ name: '', items: [] });
  const [mealItemInput, setMealItemInput] = useState({ 
    name: '', 
    calories: '', 
    protein: '', 
    fat: '', 
    carbs: '',
    servings: '1',
    icon: '🍽️'
  });

  // Authentication logic
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data fetching logic
  useEffect(() => {
    if (!user) return;

    const logsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubscribeLogs = onSnapshot(logsCol, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(logsData.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => console.error("Logs sync error:", err));

    const libraryCol = collection(db, 'artifacts', appId, 'users', user.uid, 'library');
    const unsubscribeLibrary = onSnapshot(libraryCol, (snapshot) => {
      const libData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFoodLibrary(libData.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    }, (err) => console.error("Library sync error:", err));

    const mealsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'meals');
    const unsubscribeMeals = onSnapshot(mealsCol, (snapshot) => {
      const mealsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedMeals(mealsData);
    }, (err) => console.error("Meals sync error:", err));

    return () => {
      unsubscribeLogs();
      unsubscribeLibrary();
      unsubscribeMeals();
    };
  }, [user]);

  useEffect(() => {
    setSelectedDate(null);
  }, [viewMode]);

  // AI Nutrients Retrieval with exponential backoff
  const fetchNutrients = async (targetName, setter, loadingSetter, errorSetter) => {
    if (!targetName) return;
    loadingSetter(true);
    errorSetter("");
    
    // Use resolved key
    const apiKey = appConfig.geminiKey || ""; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
   
    const payload = {
      contents: [{ parts: [{ text: `Provide estimated calories, protein, fat, carbs, and a relevant food icon for: ${targetName}` }] }],
      systemInstruction: { 
        parts: [{ 
          text: "You are a highly accurate nutritional analysis engine. Provide estimated nutritional quantities (calories, protein, fat, carbs) for a single standard serving. Include a relevant Unicode food emoji as the 'icon' field (e.g., 🥑, 🥩, 🥗, 🌯). If the input is not a recognizable food item, set isValidFood to false. Return clean JSON." 
        }] 
      },
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            calories: { type: "NUMBER" },
            protein: { type: "NUMBER" },
            fat: { type: "NUMBER" },
            carbs: { type: "NUMBER" },
            icon: { type: "STRING" },
            isValidFood: { type: "BOOLEAN" }
          },
          required: ["calories", "protein", "fat", "carbs", "icon", "isValidFood"]
        }
      }
    };

    const callApiWithRetry = async (retries = 0) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.status === 401 || response.status === 403) {
          throw new Error("Invalid API Key. Check your environment variables.");
        }

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(text);
      } catch (error) {
        if (error.message.includes("Key")) throw error;
        if (retries < 5) {
          const delay = Math.pow(2, retries) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return callApiWithRetry(retries + 1);
        }
        throw error;
      }
    };

    try {
      const result = await callApiWithRetry();
      if (!result.isValidFood) {
        errorSetter(`${targetName} is not a valid food item for AI Fill. Try again.`);
      } else {
        setter(prev => ({
          ...prev,
          calories: result.calories,
          protein: result.protein,
          fat: result.fat,
          carbs: result.carbs,
          icon: result.icon || '🍽️'
        }));
      }
    } catch (err) {
      errorSetter(err.message || "Network error during AI analysis. Please try again.");
    } finally {
      loadingSetter(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (selectedDate) {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0,0,0,0);
      const dayEnd = dayStart.getTime() + (24 * 60 * 60 * 1000);
      return entries.filter(e => e.timestamp >= dayStart.getTime() && e.timestamp < dayEnd);
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (viewMode === 'today') return entries.filter(e => e.timestamp >= todayStart);
    if (viewMode === 'week') return entries.filter(e => e.timestamp >= (todayStart - 6 * 24 * 60 * 60 * 1000));
    return entries.filter(e => e.timestamp >= new Date(now.getFullYear(), now.getMonth(), 1).getTime());
  }, [entries, viewMode, selectedDate]);

  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => ({
      calories: acc.calories + Number(curr.calories || 0),
      protein: acc.protein + Number(curr.protein || 0),
      fat: acc.fat + Number(curr.fat || 0),
      carbs: acc.carbs + Number(curr.carbs || 0),
      servings: acc.servings + Number(curr.servings || 0)
    }), { calories: 0, protein: 0, fat: 0, carbs: 0, servings: 0 });
  }, [filteredEntries]);

  const weeklyMatrixData = useMemo(() => {
    if (viewMode !== 'week' || selectedDate) return null;
    const days = [];
    const matrix = { kcal: [], protein: [], fat: [], carbs: [] };
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      const dayEntries = entries.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'long' }), date: d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }), timestamp: dayStart });
      matrix.kcal.push(dayEntries.reduce((s, e) => s + Number(e.calories || 0), 0));
      matrix.protein.push(dayEntries.reduce((s, e) => s + Number(e.protein || 0), 0));
      matrix.fat.push(dayEntries.reduce((s, e) => s + Number(e.fat || 0), 0));
      matrix.carbs.push(dayEntries.reduce((s, e) => s + Number(e.carbs || 0), 0));
    }
    return { days, matrix };
  }, [entries, viewMode, selectedDate]);

  const monthlyCalendarData = useMemo(() => {
    if (viewMode !== 'month' || selectedDate) return null;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayGrids = [];
    for (let i = 0; i < firstDay; i++) dayGrids.push({ type: 'empty' });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const start = date.getTime();
      const end = start + (24 * 60 * 60 * 1000);
      const dayEntries = entries.filter(e => e.timestamp >= start && e.timestamp < end);
      dayGrids.push({
        type: 'day', dayNum: d, timestamp: start, isToday: d === now.getDate(),
        kcal: Math.round(dayEntries.reduce((s, e) => s + Number(e.calories || 0), 0)),
        protein: Math.round(dayEntries.reduce((s, e) => s + Number(e.protein || 0), 0) * 10) / 10,
        fat: Math.round(dayEntries.reduce((s, e) => s + Number(e.fat || 0), 0) * 10) / 10,
        carbs: Math.round(dayEntries.reduce((s, e) => s + Number(e.carbs || 0), 0) * 10) / 10
      });
    }
    return { dayGrids, monthName: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }, [entries, viewMode, selectedDate]);

  const suggestions = useMemo(() => {
    if (!formData.name || formData.name.length < 2) return [];
    const term = formData.name.toLowerCase();
    const libMatches = foodLibrary.filter(item => (item.name || "").toLowerCase().includes(term)).map(i => ({ ...i, type: 'food' }));
    const mealMatches = savedMeals.filter(meal => (meal.name || "").toLowerCase().includes(term)).map(m => ({ ...m, type: 'meal' }));
    return [...mealMatches, ...libMatches].slice(0, 5);
  }, [formData.name, foodLibrary, savedMeals]);

  const componentSuggestions = useMemo(() => {
    if (!mealItemInput.name || mealItemInput.name.length < 2) return [];
    const term = mealItemInput.name.toLowerCase();
    return foodLibrary.filter(item => (item.name || "").toLowerCase().includes(term)).slice(0, 5);
  }, [mealItemInput.name, foodLibrary]);

  const handleArrowNavigation = (e, index, refs) => {
    if (e.key === 'ArrowRight') {
      const isAtEnd = e.target.selectionEnd === (e.target.value?.length || 0);
      const isNumber = e.target.type === 'number';
      if ((isAtEnd || isNumber) && index < refs.length - 1) {
        e.preventDefault();
        refs[index + 1].current.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      const isAtStart = e.target.selectionStart === 0;
      const isNumber = e.target.type === 'number';
      if ((isAtStart || isNumber) && index > 0) {
        e.preventDefault();
        refs[index - 1].current.focus();
      }
    }
  };

  const selectSuggestion = (item) => {
    setFormData({ 
      name: item.name, 
      calories: item.calories, 
      protein: item.protein, 
      fat: item.fat, 
      carbs: item.carbs, 
      servings: '1',
      icon: item.icon || '🍽️'
    });
    setShowSuggestions(false);
    setMainAiError("");
  };

  const handleMainSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.calories) return;
    const multiplier = Number(formData.servings) || 1;
    const payload = {
      name: formData.name, servings: multiplier,
      calories: Math.round(Number(formData.calories) * multiplier),
      protein: Math.round(Number(formData.protein || 0) * multiplier * 10) / 10,
      fat: Math.round(Number(formData.fat || 0) * multiplier * 10) / 10,
      carbs: Math.round(Number(formData.carbs || 0) * multiplier * 10) / 10,
      icon: formData.icon || '🍽️',
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), payload);
      const libId = formData.name.toLowerCase().trim().replace(/\s+/g, '-');
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'library', libId), {
        name: formData.name, 
        calories: Number(formData.calories), 
        protein: Number(formData.protein || 0), 
        fat: Number(formData.fat || 0), 
        carbs: Number(formData.carbs || 0), 
        icon: formData.icon || '🍽️',
        lastUsed: Date.now()
      });
      setFormData({ name: '', calories: '', protein: '', fat: '', carbs: '', servings: '1', icon: '🍽️' });
      setMainAiError("");
    } catch (err) { console.error(err); }
  };

  const deleteEntry = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id));
  };

  const deleteFromLibrary = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'library', id));
  };

  const saveMeal = async () => {
    if (!user || !mealDraft.name || mealDraft.items.length === 0) return;
    const cumulative = mealDraft.items.reduce((acc, curr) => ({
      calories: acc.calories + Number(curr.calories),
      protein: acc.protein + Number(curr.protein || 0),
      fat: acc.fat + Number(curr.fat || 0),
      carbs: acc.carbs + Number(curr.carbs || 0)
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    const mealPayload = { ...mealDraft, ...cumulative, timestamp: Date.now() };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'meals'), mealPayload);
      setMealDraft({ name: '', items: [] });
      setMealAiError("");
    } catch (err) { console.error(err); }
  };

  const deleteMeal = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'meals', id));
  };

  const addItemToMeal = () => {
    if (!mealItemInput.name || !mealItemInput.calories) return;
    const multiplier = Number(mealItemInput.servings) || 1;
    const componentToAdd = {
      name: `${mealItemInput.name}${multiplier !== 1 ? ` (x${multiplier})` : ''}`,
      calories: Math.round(Number(mealItemInput.calories) * multiplier),
      protein: Math.round(Number(mealItemInput.protein || 0) * multiplier * 10) / 10,
      fat: Math.round(Number(mealItemInput.fat || 0) * multiplier * 10) / 10,
      carbs: Math.round(Number(mealItemInput.carbs || 0) * multiplier * 10) / 10,
      icon: mealItemInput.icon || '🍽️',
      servings: multiplier,
      id: crypto.randomUUID()
    };
    setMealDraft(prev => ({ ...prev, items: [...prev.items, componentToAdd] }));
    setMealItemInput({ name: '', calories: '', protein: '', fat: '', carbs: '', servings: '1', icon: '🍽️' });
    setMealAiError("");
  };

  const handleTooltipStart = (timerRef, setter) => {
    timerRef.current = setTimeout(() => setter(true), 1000);
  };

  const handleTooltipEnd = (timerRef, setter) => {
    clearTimeout(timerRef.current);
    setter(false);
  };

  const NavigationMenu = () => (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-stone-100 rounded-xl text-stone-600 transition-colors">
        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-stone-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2">
          <button onClick={() => { setCurrentScreen('about'); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-stone-700 font-bold text-sm flex items-center gap-3 transition-colors">
            <HelpCircle className="w-4 h-4 text-emerald-600" /> About
          </button>
          <button onClick={() => { window.open('https://www.wikipedia.org', '_blank'); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-stone-700 font-bold text-sm flex items-center gap-3 transition-colors">
            <Coffee className="w-4 h-4 text-amber-600" /> Buy me a coffee
          </button>
        </div>
      )}
    </div>
  );

  const Header = () => (
    <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="cursor-pointer" onClick={() => setCurrentScreen('main')}>
          <LogoIcon />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-stone-800 italic">ChartYourFood</h1>
          <p className="text-emerald-700/70 text-sm font-medium italic">The Rational Quantitative Diet Log</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentScreen('foods')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 text-sm">
          <Database className="w-4 h-4" /> My Foods
        </button>
        <button onClick={() => setCurrentScreen('meals')} className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-6 rounded-2xl transition-all shadow-lg shadow-sky-100 flex items-center gap-2 text-sm">
          <ChefHat className="w-4 h-4" /> My Meals
        </button>
        <div className="hidden md:flex flex-col items-end text-right">
          <div className="bg-emerald-100 px-4 py-2 rounded-full border border-emerald-200 flex items-center gap-2 tracking-widest font-bold uppercase text-xs text-emerald-800">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Synchronized
          </div>
        </div>
        <NavigationMenu />
      </div>
    </header>
  );

  if (currentScreen === 'about') {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8 animate-in fade-in">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setCurrentScreen('main')} className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:translate-x-[-4px] transition-transform"><ArrowLeft className="w-5 h-5" /> Back</button>
          <article className="bg-white rounded-[2rem] shadow-xl border border-stone-100 p-10 md:p-16 space-y-12">
            <header className="space-y-4">
              <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><HelpCircle className="w-8 h-8 text-emerald-600" /></div>
              <h1 className="text-4xl font-black text-stone-800 italic tracking-tight">About ChartYourFood</h1>
              <div className="h-1 w-20 bg-emerald-500 rounded-full" />
            </header>
            <section className="space-y-6 text-stone-600 leading-relaxed">
              <p className="text-lg font-medium text-stone-800">ChartYourFood is a high-fidelity quantitative analysis platform designed for the rigorous tracking of nutritional density and caloric expenditure.</p>
              <p>In an era of information overflow, this tool provides a rational interface for individuals who prioritize data integrity in their dietary habits.</p>
            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-stone-100 pt-12">
              <div className="space-y-4"><div className="flex items-center gap-3 text-emerald-800 font-black uppercase text-xs tracking-widest"><Code2 className="w-4 h-4" /> Vibe Coding Methodology</div><p className="text-sm text-stone-500 italic">Architected using intent-modeled software generation and rapid iteration.</p></div>
              <div className="space-y-4"><div className="flex items-center gap-3 text-emerald-800 font-black uppercase text-xs tracking-widest"><Utensils className="w-4 h-4" /> Authorial Intent</div><p className="text-sm text-stone-500 font-medium">Built by <span className="text-stone-800 font-bold">Caden Andrews</span>.</p></div>
            </section>
          </article>
        </div>
      </div>
    );
  }

  if (currentScreen === 'foods') {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8 animate-in fade-in">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setCurrentScreen('main')} className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:translate-x-[-4px] transition-transform">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <section className="bg-white rounded-[2rem] shadow-xl border border-stone-100 p-8">
            <header className="flex items-center gap-3 mb-10 border-b border-stone-100 pb-6">
              <h2 className="text-2xl font-black tracking-tight" style={{ WebkitTextStroke: '1px #059669', color: 'white' }}>Personal Food Database</h2>
              <Database className="w-6 h-6 text-emerald-600" />
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-100 font-black text-stone-400 uppercase text-[10px] tracking-widest">
                    <th className="px-8 py-5">Food Item</th>
                    <th className="px-8 py-5 text-right">Calories</th>
                    <th className="px-8 py-5 text-right">Protein (g)</th>
                    <th className="px-8 py-5 text-right">Fat (g)</th>
                    <th className="px-8 py-5 text-right">Carbs (g)</th>
                    <th className="px-8 py-5 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {foodLibrary.length === 0 ? (
                    <tr><td colSpan="6" className="px-8 py-20 text-center text-stone-400 font-medium italic">Database is empty.</td></tr>
                  ) : (
                    foodLibrary.map((food) => (
                      <tr key={food.id} className="hover:bg-emerald-50/30 transition-colors group text-sm">
                        <td className="px-8 py-4 font-bold text-stone-800 flex items-center gap-3">
                          <span className="text-lg grayscale-0 group-hover:scale-110 transition-transform">{food.icon || '🍽️'}</span>
                          {food.name}
                        </td>
                        <td className="px-8 py-4 font-mono font-bold text-right text-stone-600">{food.calories}</td>
                        <td className="px-8 py-4 font-mono text-right text-stone-500">{food.protein || 0}</td>
                        <td className="px-8 py-4 font-mono text-right text-stone-500">{food.fat || 0}</td>
                        <td className="px-8 py-4 font-mono text-right text-stone-500">{food.carbs || 0}</td>
                        <td className="px-8 py-4 text-center">
                          <button onClick={() => deleteFromLibrary(food.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (currentScreen === 'meals') {
    return (
      <div className="min-h-screen bg-sky-50 text-stone-900 font-sans p-4 md:p-8 animate-in fade-in">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setCurrentScreen('main')} className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:translate-x-[-4px] transition-transform"><ArrowLeft className="w-5 h-5" /> Back</button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <section className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-[2rem] shadow-xl border border-stone-100 p-8">
                <div className="flex items-center gap-2 mb-6"><h2 className="text-2xl font-black tracking-tight" style={{ WebkitTextStroke: '1px #059669', color: 'white' }}>Meal Builder</h2><ChefHat className="w-6 h-6 text-emerald-600" /></div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={`${synchronizedLabelStyle} ml-6 block mb-2`}>Meal name</label>
                    <input 
                      ref={mealInputRefs[0]}
                      onKeyDown={(e) => handleArrowNavigation(e, 0, mealInputRefs)}
                      type="text" placeholder="e.g. Daily Shake" value={mealDraft.name} onChange={(e) => setMealDraft(p => ({ ...p, name: e.target.value }))} className={standardInputStyle} />
                  </div>
                  
                  <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 space-y-4 relative overflow-visible">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className={synchronizedLabelStyle}>Add Component</h3>
                    </div>
                    <div className="relative" ref={componentSuggestionRef}>
                      <input 
                        ref={mealInputRefs[1]}
                        onKeyDown={(e) => handleArrowNavigation(e, 1, mealInputRefs)}
                        type="text" placeholder="Describe component or search..." value={mealItemInput.name} onChange={(e) => { setMealItemInput(p => ({ ...p, name: e.target.value })); setShowComponentSuggestions(true); }} className={`${standardInputStyle} pr-32 bg-white`} />
                      <div className="absolute right-1.5 top-1.5 bottom-1.5">
                        <button 
                          type="button" 
                          onMouseEnter={() => handleTooltipStart(mealTooltipTimer, setShowMealTooltip)}
                          onMouseLeave={() => handleTooltipEnd(mealTooltipTimer, setShowMealTooltip)}
                          onClick={() => fetchNutrients(mealItemInput.name, setMealItemInput, setIsMealAiLoading, setMealAiError)} 
                          disabled={isMealAiLoading || !mealItemInput.name} 
                          className="h-full px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isMealAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          <span className="text-xs font-bold uppercase tracking-tighter">AI Fill</span>
                        </button>
                        {showMealTooltip && <div className={tooltipStyle}>This lets AI make its best guess at the nutritional values and fill the fields for you</div>}
                      </div>
                      {showComponentSuggestions && componentSuggestions.length > 0 && (<div className="absolute z-50 w-full mt-1 bg-white border border-stone-100 shadow-xl rounded-xl overflow-hidden">{componentSuggestions.map((item, idx) => (<button key={idx} type="button" onClick={() => { setMealItemInput({ ...item, servings: '1' }); setShowComponentSuggestions(false); }} className="w-full px-4 py-2 text-left hover:bg-emerald-50 text-xs font-bold text-stone-600 transition-colors border-b last:border-0 border-stone-50"><span className="mr-2">{item.icon}</span>{item.name} ({item.calories} kcal)</button>))}</div>)}
                    </div>
                    
                    {mealAiError && (
                      <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="text-[10px] font-bold uppercase tracking-tight">{mealAiError}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Row 1: Calories and Protein */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={miniLabelStyle}>Calories</label>
                          <input 
                            ref={mealInputRefs[2]}
                            onKeyDown={(e) => handleArrowNavigation(e, 2, mealInputRefs)}
                            type="number" placeholder="0" value={mealItemInput.calories} onChange={(e) => setMealItemInput(p => ({ ...p, calories: e.target.value }))} className={`${standardInputStyle} bg-white px-4 py-2`} />
                        </div>
                        <div>
                          <label className={miniLabelStyle}>Protein (g)</label>
                          <input 
                            ref={mealInputRefs[3]}
                            onKeyDown={(e) => handleArrowNavigation(e, 3, mealInputRefs)}
                            type="number" placeholder="0" value={mealItemInput.protein} onChange={(e) => setMealItemInput(p => ({ ...p, protein: e.target.value }))} className={`${standardInputStyle} bg-white px-4 py-2`} />
                        </div>
                      </div>
                      {/* Row 2: Fat, Carbs, and Servings */}
                      <div className="grid grid-cols-[1fr_0.7fr_1fr] gap-3">
                        <div>
                          <label className={miniLabelStyle}>Fat (g)</label>
                          <input 
                            ref={mealInputRefs[4]}
                            onKeyDown={(e) => handleArrowNavigation(e, 4, mealInputRefs)}
                            type="number" placeholder="0" value={mealItemInput.fat} onChange={(e) => setMealItemInput(p => ({ ...p, fat: e.target.value }))} className={`${standardInputStyle} bg-white px-4 py-2`} />
                        </div>
                        <div>
                          <label className={miniLabelStyle}>Carbs (g)</label>
                          <input 
                            ref={mealInputRefs[5]}
                            onKeyDown={(e) => handleArrowNavigation(e, 5, mealInputRefs)}
                            type="number" placeholder="0" value={mealItemInput.carbs} onChange={(e) => setMealItemInput(p => ({ ...p, carbs: e.target.value }))} className={`${standardInputStyle} bg-white px-4 py-2`} />
                        </div>
                        <div>
                          <label className={miniLabelStyle}>Servings</label>
                          <input type="number" step="0.1" value={mealItemInput.servings} onChange={(e) => setMealItemInput(p => ({ ...p, servings: e.target.value }))} className={`${standardInputStyle} bg-emerald-50 border-emerald-100 px-4 py-2 font-bold text-emerald-800`} />
                        </div>
                      </div>
                    </div>
                    <button onClick={addItemToMeal} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold text-sm shadow-md active:translate-y-px transition-transform">Add to Draft</button>
                  </div>

                  <div className="bg-stone-100/50 p-6 rounded-[2rem] border border-stone-200/50 min-h-[120px]">
                    <h3 className={synchronizedLabelStyle + " mb-4 text-[10px]"}>Current Selection</h3>
                    {mealDraft.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-24 opacity-40">
                        <Utensils className="w-6 h-6 mb-2 text-stone-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Components will go here</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {mealDraft.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-white px-4 py-3 rounded-xl text-sm shadow-sm border border-stone-100">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{item.icon || '🍽️'}</span>
                              <div>
                                <span className="font-bold text-stone-800 block">{item.name}</span>
                                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">{item.protein}P · {item.fat}F · {item.carbs}C</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-emerald-700 font-mono font-bold">{item.calories} kcal</span>
                              <button onClick={() => setMealDraft(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))} className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button onClick={saveMeal} disabled={!mealDraft.name || mealDraft.items.length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-sm shadow-md active:translate-y-px transition-transform disabled:opacity-50">Confirm & Save Meal</button>
                </div>
              </div>
            </section>
            <section className="md:col-span-1 space-y-4">
              <h2 className={`${synchronizedLabelStyle} px-2 flex items-center gap-2`}><History className="w-3 h-3" /> Saved Meals</h2>
              <div className="space-y-3">
                {savedMeals.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs italic bg-white rounded-2xl border border-dashed border-stone-200">No meals saved.</div>
                ) : (
                  savedMeals.map(meal => (
                    <div key={meal.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex justify-between items-center group transition-all hover:shadow-md">
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                          {meal.name} 
                          <span className="opacity-70 text-xs">
                            {meal.items.map(item => {
                              const count = Math.max(1, Math.round(item.servings || 1));
                              return Array(count).fill(item.icon).join('');
                            }).join('')}
                          </span>
                        </h4>
                        <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">{meal.items.length} items · {meal.calories} kcal</p>
                      </div>
                      <button onClick={() => deleteMeal(meal.id)} className="opacity-0 group-hover:opacity-100 p-2 text-stone-300 hover:text-red-500 transition-all shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Dashboard Screen ---
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Header />
        <main className="space-y-8">
          <section className="bg-white rounded-[2rem] shadow-xl shadow-stone-200/50 border border-stone-100 p-8 relative overflow-visible">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Utensils className="w-32 h-32 text-emerald-900" /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 items-center mb-8 relative z-10 gap-4">
              <div className="flex items-center gap-2 mb-6"><h2 className="text-2xl font-black tracking-tight" style={{ WebkitTextStroke: '1px #059669', color: 'white' }}>Food Entry</h2><Plus className="w-6 h-6 text-emerald-600" /></div>
            </div>
            <form onSubmit={handleMainSubmit} className="space-y-6 relative z-10">
              <div className="space-y-2 relative" ref={suggestionRef}>
                <label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Food item</label>
                <div className="relative">
                  <input 
                    ref={mainInputRefs[0]}
                    onKeyDown={(e) => handleArrowNavigation(e, 0, mainInputRefs)}
                    type="text" autoComplete="off" placeholder="Search foods or meals. New foods will be added to the database." value={formData.name} onChange={(e) => { setFormData(p => ({ ...p, name: e.target.value })); setShowSuggestions(true); }} className={standardInputStyle} required />
                  <div className="absolute right-2 top-2 bottom-2">
                    <button 
                      type="button" 
                      onMouseEnter={() => handleTooltipStart(mainTooltipTimer, setShowMainTooltip)}
                      onMouseLeave={() => handleTooltipEnd(mainTooltipTimer, setShowMainTooltip)}
                      onClick={() => fetchNutrients(formData.name, setFormData, setIsAiLoading, setMainAiError)} 
                      disabled={isAiLoading || !formData.name} 
                      className="h-full px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span className="text-xs font-bold uppercase tracking-tight">AI Fill</span>
                    </button>
                    {showMainTooltip && <div className={tooltipStyle}>This lets AI make its best guess at the nutritional values and fill the fields for you</div>}
                  </div>
                </div>
                {showSuggestions && suggestions.length > 0 && (<div className="absolute z-50 w-full mt-2 bg-white border border-stone-100 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">{suggestions.map((item, idx) => (<button key={idx} type="button" onClick={() => selectSuggestion(item)} className="w-full px-5 py-3 text-left hover:bg-emerald-50 flex justify-between items-center group border-b border-stone-50 last:border-0"><div className="flex items-center gap-3"><span className="text-xl">{item.icon || '🍽️'}</span><div><span className="text-sm font-bold text-stone-700">{item.name}</span><p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{item.type === 'meal' ? 'Meal' : 'Lib'} · {item.calories} kcal</p></div></div><Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100" /></button>))}</div>)}
              </div>
              {mainAiError && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-wider">{mainAiError}</p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Calories</label>
                  <input 
                    ref={mainInputRefs[1]}
                    onKeyDown={(e) => handleArrowNavigation(e, 1, mainInputRefs)}
                    type="number" placeholder="kcal" value={formData.calories} onChange={(e) => setFormData(p => ({ ...p, calories: e.target.value }))} className={standardInputStyle} required />
                </div>
                <div><label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Protein (g)</label><input ref={mainInputRefs[2]} onKeyDown={(e) => handleArrowNavigation(e, 2, mainInputRefs)} type="number" value={formData.protein} onChange={(e) => setFormData(p => ({ ...p, protein: e.target.value }))} className={standardInputStyle} /></div>
                <div><label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Fat (g)</label><input ref={mainInputRefs[3]} onKeyDown={(e) => handleArrowNavigation(e, 3, mainInputRefs)} type="number" value={formData.fat} onChange={(e) => setFormData(p => ({ ...p, fat: e.target.value }))} className={standardInputStyle} /></div>
                <div><label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Carbs (g)</label><input ref={mainInputRefs[4]} onKeyDown={(e) => handleArrowNavigation(e, 4, mainInputRefs)} type="number" value={formData.carbs} onChange={(e) => setFormData(p => ({ ...p, carbs: e.target.value }))} className={standardInputStyle} /></div>
                <div><label className={`${synchronizedLabelStyle} block mb-2 ml-1`}>Servings</label><input ref={mainInputRefs[5]} onKeyDown={(e) => handleArrowNavigation(e, 5, mainInputRefs)} type="number" step="0.1" value={formData.servings} onChange={(e) => setFormData(p => ({ ...p, servings: e.target.value }))} className={`${standardInputStyle} bg-emerald-50 border-emerald-100 font-bold text-emerald-800`} /></div>
              </div>
              <div className="w-full pt-2">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus className="w-6 h-6" />
                  <span className="uppercase tracking-widest font-black text-sm">Add to Log</span>
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-2">
              <div className="bg-stone-200/50 p-1.5 rounded-2xl flex w-full md:w-auto">
                <button onClick={() => setViewMode('today')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'today' ? 'bg-white text-emerald-800 shadow-md' : 'text-stone-500'}`}>Today</button>
                <button onClick={() => setViewMode('week')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white text-emerald-800 shadow-md' : 'text-stone-500'}`}>This Week</button>
                <button onClick={() => setViewMode('month')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white text-emerald-800 shadow-md' : 'text-stone-500'}`}>This Month</button>
              </div>
              <div className="bg-emerald-900 p-4 rounded-2xl shadow-xl w-full md:w-auto min-w-[200px]"><p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Aggregate Energy Intake</p><p className="text-3xl font-black text-white">{totals.calories.toLocaleString()}<span className="text-sm ml-1 font-medium text-emerald-300">kcal</span></p></div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-stone-100 overflow-hidden">
              <div className="overflow-x-auto">
                {(viewMode === 'today' || selectedDate) ? (
                  <div>
                    <div className="bg-stone-50/80 border-b border-stone-100 px-8 py-4 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        {selectedDate && (<button onClick={() => setSelectedDate(null)} className="flex items-center gap-2 text-xs font-black text-emerald-800 uppercase tracking-widest hover:text-emerald-600 transition-colors"><ChevronLeft className="w-4 h-4" /> Back</button>)}
                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">{selectedDate ? `Logs for ${new Date(selectedDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}` : 'Daily Logs'}</h3>
                      </div>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50/40 border-b border-stone-100 font-black text-stone-400 uppercase text-[10px] tracking-widest">
                          <th className="px-8 py-5 text-left">Item</th><th className="px-4 py-5 text-center">Qty</th><th className="px-8 py-5 text-right">Kcal</th><th className="px-8 py-5 text-right">Protein (g)</th><th className="px-8 py-5 text-right">Fat (g)</th><th className="px-8 py-5 text-right">Carbs (g)</th><th className="px-8 py-5 text-center">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {filteredEntries.length === 0 ? (<tr><td colSpan="7" className="px-8 py-20 text-center text-stone-400 font-medium">No records logged.</td></tr>) : (<>{filteredEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-emerald-50/30 transition-colors group text-sm">
                            <td className="px-8 py-4 font-bold text-stone-800 flex items-center gap-3">
                              <span className="text-lg">{entry.icon || '🍽️'}</span>
                              {entry.name}
                            </td>
                            <td className="px-4 py-4 font-mono font-bold text-center text-emerald-700">{entry.servings || 1}</td>
                            <td className="px-8 py-4 font-mono font-bold text-right text-stone-600">{entry.calories}</td>
                            <td className="px-8 py-4 font-mono text-right text-stone-500">{entry.protein || 0}</td>
                            <td className="px-8 py-4 font-mono text-right text-stone-500">{entry.fat || 0}</td>
                            <td className="px-8 py-4 font-mono text-right text-stone-500">{entry.carbs || 0}</td>
                            <td className="px-8 py-4 text-center">
                              <button onClick={() => deleteEntry(entry.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}<tr className="bg-emerald-50/50 border-t-2 border-emerald-100 font-black text-emerald-900">
                          <td className="px-8 py-5 text-sm">Total</td>
                          <td className="px-4 py-5 text-center font-mono">{Math.round(totals.servings * 10) / 10}</td>
                          <td className="px-8 py-5 text-right font-mono text-base underline decoration-emerald-200 underline-offset-4">{totals.calories.toLocaleString()}</td>
                          <td className="px-8 py-5 text-right font-mono">{totals.protein}</td>
                          <td className="px-8 py-5 text-right font-mono">{totals.fat}</td>
                          <td className="px-8 py-5 text-right font-mono">{totals.carbs}</td>
                          <td></td>
                        </tr></>)}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  viewMode === 'week' ? (
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-stone-50/80 border-b border-stone-100 font-black text-stone-400 uppercase text-[10px] tracking-widest"><th className="px-8 py-5 sticky left-0 bg-stone-50 z-10 border-r border-stone-200">Matrix</th>{weeklyMatrixData.days.map((day, idx) => (<th key={idx} onClick={() => setSelectedDate(day.timestamp)} className={`px-6 py-5 text-center min-w-[100px] cursor-pointer hover:bg-emerald-50 transition-colors ${idx === 6 ? 'text-emerald-700 bg-emerald-50/30 font-bold' : ''}`}><div className="text-[9px] mb-0.5 opacity-60">{day.label}</div><div>{day.date}</div></th>))}</tr></thead>
                      <tbody className="divide-y divide-stone-50">
                        {/* Weekly Data Rows */}
                        {[
                          { label: 'kcal', icon: TrendingUp, color: 'emerald', data: weeklyMatrixData.matrix.kcal, format: v => v.toLocaleString() },
                          { label: 'Prot (g)', icon: null, color: 'amber', data: weeklyMatrixData.matrix.protein },
                          { label: 'Fat (g)', icon: null, color: 'emerald', data: weeklyMatrixData.matrix.fat },
                          { label: 'Carb (g)', icon: null, color: 'blue', data: weeklyMatrixData.matrix.carbs }
                        ].map((row) => (
                          <tr key={row.label} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-8 py-6 font-bold text-stone-600 sticky left-0 bg-white border-r border-stone-100 flex items-center gap-2">
                              {row.icon ? <row.icon className="w-3 h-3 text-emerald-600" /> : <div className={`w-1.5 h-1.5 rounded-full bg-${row.color}-400`} />} 
                              {row.label}
                            </td>
                            {row.data.map((val, cIdx) => (
                              <td key={cIdx} onClick={() => setSelectedDate(weeklyMatrixData.days[cIdx].timestamp)} className={`px-6 py-6 text-center font-mono cursor-pointer ${cIdx === 6 ? 'bg-emerald-50/20 font-bold' : ''} ${val > 0 ? 'text-stone-700' : 'text-stone-200'}`}>
                                {val > 0 ? (row.format ? row.format(val) : Math.round(val * 10) / 10) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-4"><h3 className="text-xl font-black text-stone-800 uppercase tracking-tighter flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-emerald-600" /> {monthlyCalendarData.monthName}</h3><div className="flex items-center gap-6 bg-stone-50 px-6 py-3 rounded-2xl border border-stone-100 shadow-sm"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-stone-800" /><span className="text-[10px] font-black text-stone-400 uppercase">Kcal</span></div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-[10px] font-black text-stone-400 uppercase">Prot</span></div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-black text-stone-400 uppercase">Fat</span></div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-[10px] font-black text-stone-400 uppercase">Carb</span></div></div></div>
                      <div className="grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden shadow-inner">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ( <div key={day} className="bg-stone-50 py-3 text-center text-[10px] font-black text-stone-400 uppercase tracking-widest">{day}</div>))}{monthlyCalendarData.dayGrids.map((cell, idx) => (<div key={idx} onClick={() => cell.type === 'day' && setSelectedDate(cell.timestamp)} className={`min-h-[120px] p-2 transition-colors relative cursor-pointer group ${cell.type === 'empty' ? 'bg-stone-50/50 pointer-events-none' : 'bg-white hover:bg-emerald-50/30'}`}>{cell.type === 'day' && (<><div className="flex justify-between items-start"><span className={`text-[10px] font-black ${cell.isToday ? 'bg-emerald-600 text-white px-2 py-0.5 rounded-full' : 'text-stone-300'}`}>{cell.dayNum}</span><Plus className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" /></div><div className="mt-2 flex flex-col items-center gap-1">{cell.kcal > 0 ? (<div className="w-full space-y-0.5"><div className="text-[11px] font-black text-stone-800 text-center leading-tight">{cell.kcal}</div><div className="text-[10px] font-bold text-amber-600 text-center leading-tight">{cell.protein}g</div><div className="text-[10px] font-bold text-emerald-600 text-center leading-tight">{cell.fat}g</div><div className="text-[10px] font-bold text-blue-600 text-center leading-tight">{cell.carbs}g</div></div>) : (<div className="h-16 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-stone-100" /></div>)}</div></>)}</div>))}</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        </main>
        <footer className="mt-16 text-center text-stone-400 text-[10px] font-black uppercase tracking-[0.4em]"><p>© 2026 ChartYourFood Quantitative Analysis Engine</p></footer>
      </div>
    </div>
  );
};

export default App;
