# Frontend del POS/PWA

El frontend real del proyecto esta en:

`apps/web`

Rutas principales para editar manualmente:

- `apps/web/src/app/page.tsx`: vista de mesero y ordenes.
- `apps/web/src/app/admin/page.tsx`: panel administrativo.
- `apps/web/src/app/cocina/kanban/page.tsx`: pantalla de cocina.
- `apps/web/src/app/caja/page.tsx`: modulo de caja.
- `apps/web/src/app/inventario/page.tsx`: inventario y recetas.
- `apps/web/src/app/login/page.tsx`: inicio de sesion.
- `apps/web/src/app/styles.css`: estilos globales.

Comando para levantar solo el frontend:

```bash
cd apps/web
..\..\node_modules\.bin\next.cmd dev -p 3005
```

URL local recomendada:

`http://127.0.0.1:3005`
