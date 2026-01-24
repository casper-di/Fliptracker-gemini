# FlipTracker

## Overview
FlipTracker is a React + TypeScript frontend application that uses AI to scan emails and organize deliveries automatically. Built with Vite for fast development and building.

## Project Architecture
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini API (@google/genai)

## Project Structure
```
/
├── App.tsx            # Main application component
├── index.tsx          # Entry point
├── index.html         # HTML template
├── types.ts           # TypeScript type definitions
├── components/        # React components
├── services/          # API and service modules
│   ├── apiService.ts
│   ├── authService.ts
│   ├── geminiService.ts
│   └── mockDataService.ts
├── public/            # Static assets
└── vite.config.ts     # Vite configuration
```

## Development
- **Dev Server**: Runs on port 5000 (configured in vite.config.ts)
- **Command**: `npm run dev`
- **Build Output**: `docs/` directory

## Environment Variables
- `API_KEY`: Google Gemini API key (if using AI features)

## Deployment
- Configured for static deployment
- Build command: `npm run build`
- Output directory: `docs/`
