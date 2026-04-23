ChartYourFood: The Rational Quantitative Diet Log

Live Demo: https://chart-your-food-l0mb1p0zv-cad-ns-projects.vercel.app/

Overview

ChartYourFood is a high-fidelity quantitative analysis platform designed for the rigorous tracking of nutritional density and caloric expenditure. It provides a rational interface for individuals prioritizing data integrity in their dietary habits, moving away from subjective logging toward precise data entry and AI-assisted estimation.

Core Features

AI-Driven Nutritional Analysis: Utilizes the Gemini 2.5 Flash model to estimate caloric and macronutrient values from natural language descriptions.

Real-Time Data Synchronization: Implements Cloud Firestore for persistent, multi-device data integrity.

Quantitative Visualization: Features daily, weekly (matrix), and monthly (calendar) views for longitudinal data analysis.

Anonymous Authentication: Employs Firebase Anonymous Auth to provide immediate utility while maintaining isolated user data silos.

Technical Stack

Frontend: React 19 (Vite)

Styling: Tailwind CSS v4

Backend-as-a-Service: Firebase (Firestore, Authentication)

AI Integration: Google Generative AI (Gemini API)

Iconography: Lucide React

Architectural Note

The application adheres to a "Single-File Mandate" for its core logic (src/App.jsx) to maximize development speed and maintain high-fidelity state management. It utilizes modern React patterns, including useMemo for complex data aggregations and useRef for optimized keyboard navigation.

Developed by Caden Andrews
