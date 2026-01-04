# Real-Time Pulse - Frontend

Modern React frontend for the Real-Time Pulse enterprise dashboard platform, built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Features

- **📊 Analytics Dashboard** - Real-time metrics and insights
- **🎨 Modern UI Components** - Built with Radix UI and Tailwind CSS
- **🔐 Authentication** - Secure login with multiple providers
- **📱 Responsive Design** - Mobile-first approach with PWA support
- **⚡ Performance Optimized** - Fast loading with Next.js optimizations

## 🛠️ Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI
- **State Management:** Zustand
- **API Client:** Custom typed client
- **Charts:** Recharts

## 🚀 Getting Started

First, install dependencies:

```bash
npm install
```

Copy the environment file:

```bash
cp .env.example .env.local
```

Update the `.env.local` file with your API URL and other configuration.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (buttons, inputs, etc.)
│   └── dashboard/      # Dashboard-specific components
├── lib/                # Utilities and API clients
├── hooks/              # Custom React hooks
├── store/              # Zustand state management
└── types/              # TypeScript type definitions
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📚 Documentation

- [Main Project README](../README.md)
- [Production Features](./PRODUCTION_ENHANCEMENTS.md)
- [Component Guide](./FRONTEND_INTEGRATION.md)
