# Sistema de Inscripción de Comensales - BuenaMezcla

## Overview
Casino/cafeteria meal management system for enterprise dining. Workers register their daily meal preferences through a mobile app, generating digital vouchers (QR codes) for meal pickup. Admins manage menus, users, and casinos via a web panel.

Brand: **BuenaMezcla** (rebranded from Vascan SPA). Logo at `pwa/public/logo.png`, `web/src/logo.png`, `public/logo.png`.

## Architecture
- **Backend**: Express.js + TypeScript on port 5000
- **Database**: PostgreSQL with Drizzle ORM
- **Mobile App**: React Native (Expo) on port 8081
- **Admin Web Panel**: React SPA served at `/admin` on port 5000
- **Auth**: Session-based with bcryptjs password hashing
- **Auto-seed**: Database seeds automatically on first startup
- **Static files**: `public/` directory served statically (case studies, etc.)

## Data Model
- **Users**: Authenticated via Chilean RUT + password. Roles: admin, comensal, interlocutor. Has optional `telefono` field for Twilio reminders
- **Casinos**: Dining locations/venues with `comensalesDiarios` (expected daily diners) for participation tracking  
- **Minutas**: Daily menus with up to 5 options per date per casino. Each has a `familia` field linked to dynamic Familias table
- **Familias**: Dynamic categories for minutas (Almuerzo, Desayuno, Colación, VIP, etc.) with custom colors. Admin CRUD via `/api/familias`
- **Pedidos**: Meal orders linking users to their selected menu option. Has `tipo` field (seleccion, no_asiste, visita) and optional `nombreVisita` for visitor vouchers
- **Periodos**: Enrollment time windows per casino

## Key Files
### Backend
- `shared/schema.ts` - Drizzle schema with all entities (users, casinos, minutas, familias, pedidos, periodos)
- `server/routes.ts` - Full CRUD API endpoints + auto-seed
- `server/storage.ts` - Database access layer with CRUD operations
- `server/db.ts` - Database connection

### Mobile App
- `lib/auth-context.tsx` - Auth state management with AsyncStorage
- `lib/query-client.ts` - React Query + API utilities
- `app/login.tsx` - Login screen with RUT auto-formatting
- `app/(main)/home.tsx` - Weekly inscription view with expandable day cards, option selection, no_asiste, and batch submit
- `app/(main)/minuta-detail.tsx` - Menu option detail + QR voucher display
- `app/(main)/vale-visita.tsx` - Interlocutor visitor voucher creation screen

### Admin Web Panel
- `web/src/admin.html` - React SPA with Tailwind CSS (served at /admin)
  - Dashboard with stats (users, casinos, minutas, inscripciones, no_asiste, visitas)
  - Usuarios: Full CRUD with RUT auto-formatting
  - Casinos: Full CRUD
  - Minutas: Full CRUD per casino with dynamic familia filter, multi-casino assignment, clone feature
  - Familias: Full CRUD (create custom familias with colors)
  - Consolidation report with no_asiste/visita breakdowns
  - Periodos: Enrollment time windows management
  - Bulk upload from Excel (users + minutas)

### Static Pages
- `public/casos-de-estudio/vascan-sistema-comensales.html` - WebMakerChile case study

## API Endpoints
### Auth
- `POST /api/auth/login` - Login with RUT + password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user

### Usuarios CRUD
- `GET /api/usuarios` - List all users
- `POST /api/usuarios` - Create user
- `PUT /api/usuarios/:id` - Update user
- `DELETE /api/usuarios/:id` - Delete user

### Casinos CRUD
- `GET /api/casinos` - List active casinos
- `GET /api/casinos/all` - List all casinos (incl. inactive)
- `POST /api/casinos` - Create casino
- `PUT /api/casinos/:id` - Update casino
- `DELETE /api/casinos/:id` - Soft-delete (deactivate) casino

### Minutas CRUD
- `GET /api/minutas` - List all minutas
- `GET /api/minutas/:casinoId` - Get minutas for a casino
- `POST /api/minutas` - Create minuta (supports `casinoIds` array for multi-casino)
- `PUT /api/minutas/:id` - Update minuta (accepts `replicateToCasinoIds: string[]` to mirror changes to matching minutas in other casinos)
- `DELETE /api/minutas/:id` - Soft-delete (deactivate) minuta
- `POST /api/minutas/:id/clonar` - Clone minuta to new date/casinos

### Familias CRUD
- `GET /api/familias` - List all familias
- `POST /api/familias` - Create familia
- `PUT /api/familias/:id` - Update familia (name, color, activo)

### Periodos CRUD
- `GET /api/periodos` - List all periodos (admin)
- `GET /api/periodos/casino/:casinoId` - Get periodos for a casino
- `POST /api/periodos` - Create periodo (admin)
- `PUT /api/periodos/:id` - Update periodo (admin)
- `DELETE /api/periodos/:id` - Soft-delete (deactivate) periodo

### Pedidos
- `POST /api/pedidos` - Create single meal order (validates active periodo)
- `POST /api/pedidos/semanal` - Batch weekly inscription (array of selections with tipo)
- `POST /api/pedidos/visita` - Create visitor voucher (interlocutor/admin only)
- `GET /api/pedidos/:userId` - Get user's orders

### Reports
- `GET /api/reportes/dashboard` - Dashboard stats (inscripciones, no_asiste, visitas counts)
- `GET /api/reportes/consolidacion?casinoId=X&fecha=Y[&fechaHasta=Z]` - Consolidation report with no_asiste/visita breakdown
- `GET /api/reportes/inscripcion-detalle?fechaDesde&fechaHasta&casinoId` - Excel: día inscripción / comensal / casino / opción / día servicio
- `GET /api/reportes/consumo-detalle?fechaDesde&fechaHasta&casinoId` - Excel: hora vale / comensal / casino / opción / día servicio (createdAt = impresión vale)
- `GET /api/reportes/minutas-detalle?mes=YYYY-MM&casinoId` - Excel: minutas detalle del mes
- Interlocutor scope: helper `scopedCasinoId()` forces casinoId to user's own when role=interlocutor

### Other
- `POST /api/usuarios/upload` - Bulk user upload from Excel
- `POST /api/minutas/upload` - Bulk minuta upload from Excel
- `GET /api/plantillas/usuarios` - Download users Excel template
- `GET /api/plantillas/minutas` - Download minutas Excel template
- `GET /api/seed` - Manual seed trigger
- `GET /admin` - Admin web panel

## Business Rules
- **Comensal**: Max 1 pedido per minuta (per day). Can declare "no_asiste" (opcion=0, no QR generated)
- **Interlocutor**: Can issue visitor vouchers (tipo=visita, with nombreVisita). Multiple pedidos per day, always forced to Opcion 1
- **Minutas**: 5 options (3 required, 2 optional), dynamic familia categorization
- **Weekly Inscription**: Comensales select options for multiple days at once via batch submit
- **Bulk Upload**: Excel with columns RUT, Nombre, Apellido, Rol, Casino (name or UUID). Default password = first 4 digits of RUT
- **Super Admin**: RUT `21212011-1` (hidden from all user listings)
- **RUT Auto-formatting**: Both mobile app and admin panel format RUT with dots and dash as user types

## Test Credentials
- Comensal: RUT `12345678-9`, password `123456`
- Admin: RUT `11111111-1`, password `123456`
- Interlocutor: RUT `22222222-2`, password `123456`
- Super Admin: RUT `21212011-1`, password `peseta832`

## Design
- Dark theme with golden/yellow accent (#D4A843)
- Poppins font family (mobile), Inter (web)
- Vascan SPA branding with logo
- Bundle ID: `com.vascan.comensales`

## Deployment
- Target: autoscale
- Build: `npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist`
- Run: `npm run server:prod`
