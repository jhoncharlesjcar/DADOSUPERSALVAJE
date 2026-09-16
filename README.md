# 🎲 DATOS SUPER SALVAJE

**Aplicación web interactiva** basada en Next.js para gestión y visualización de datos gamificados.

---

## 📋 Descripción

DATOS SUPER SALVAJE es una plataforma Next.js diseñada para crear experiencias interactivas alrededor de datos y estadísticas. Combina visualización moderna de datos con una interfaz atractiva y responsiva.

### Características Principales

- ✅ **Dashboard Interactivo** - Visualización de datos en tiempo real
- 📊 **Gráficos Dinámicos** - Recharts y visualizaciones avanzadas
- 🎮 **Gamificación** - Elementos de juego y puntos
- 📱 **Responsive Design** - Funciona en todos los dispositivos
- 🎨 **UI/UX Moderna** - Diseño premium con Tailwind CSS
- ⚡ **Rendimiento Optimizado** - Carga rápida y fluidez

---

## 🛠️ Stack Tecnológico

### Frontend
- **Next.js 14+** - Framework React
- **React 18** - Librería UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utilitarios
- **Recharts** - Gráficos interactivos
- **Lucide Icons** - Iconografía

### Backend
- **Next.js API Routes** - Backend sin servidor
- **API REST** - Endpoints personalizados

---

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 18+
- npm o yarn
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/jhoncharlesjcar/DADOSUPERSALVAJE.git
cd DADOSUPERSALVAJE
```

### 2. Instalar dependencias

```bash
npm install
# o
yarn install
```

### 3. Configurar variables de entorno

Crear archivo `.env.local`:

```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# Acceso a datos (si aplica)
API_SECRET_KEY=tu_clave_secreta
```

⚠️ **IMPORTANTE:** Nunca commitear archivos `.env` o credenciales sensibles.

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Accede a `http://localhost:3000`

---

## 📂 Estructura del Proyecto

```
DATOSSUPERSALVAJE/
├── app/
│   ├── layout.tsx             # Layout principal
│   ├── page.tsx               # Página de inicio
│   ├── dashboard/             # Módulo dashboard
│   ├── games/                 # Módulo juegos
│   ├── api/                   # API Routes
│   └── globals.css
│
├── components/
│   ├── ui/                    # Componentes base
│   ├── dashboard/             # Componentes dashboard
│   ├── layout/                # Componentes layout
│   └── GameCard.tsx
│
├── lib/
│   ├── utils.ts               # Utilidades
│   ├── api.ts                 # Cliente API
│   ├── types.ts               # Tipos TypeScript
│   └── ...
│
├── public/
│   ├── images/
│   └── icons/
│
├── .env.example               # Variables de ejemplo
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

## 🎯 Funcionalidades Principales

### Dashboard
- Tarjetas de estadísticas
- Gráficos de tendencias
- Indicadores KPI
- Últimas actividades

### Módulo de Juegos
- Mini-juegos interactivos
- Sistema de puntos y logros
- Leaderboard
- Desafíos diarios

### Visualización de Datos
- Gráficos interactivos
- Filtros dinámicos
- Comparativas temporales

---

## 📊 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run start        # Iniciar servidor
npm run lint         # Linter
```

---

## 🚀 Despliegue

### Vercel

```bash
npm install -g vercel
vercel
```

### Docker

```bash
docker build -t datos-super-salvaje .
docker run -p 3000:3000 datos-super-salvaje
```

---

## 🔒 Seguridad

- ✅ Nunca exponer credenciales en código
- ✅ Usar `.env.local` para variables sensibles
- ✅ Validación de entrada en APIs
- ✅ Headers de seguridad HTTP
- ✅ CORS configurado

---

## 📄 Licencia

Propietario - © Jcar Labs. Todos los derechos reservados.

---

**Desarrollado con ❤️ por Jcar Labs**