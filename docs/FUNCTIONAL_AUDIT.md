# Diagnostico funcional del POS/PWA

Este documento controla que cada modulo avance con funcionalidad real: API, Prisma, PostgreSQL, validaciones, permisos, mensajes de error y acciones visibles conectadas. No se considera terminado un modulo que solo muestra pantalla o formulario decorativo.

## Criterios de estado

- **Funcional:** consulta y guarda datos reales, refresca la pantalla, muestra estados de carga/error/exito y respeta permisos.
- **Parcial:** tiene backend real o parte del frontend real, pero falta editar, desactivar, cancelar, refetch o una accion visible.
- **Pendiente:** no hay flujo operativo suficiente para usarlo en restaurante.
- **No aplica CRUD completo:** el modulo es operativo o de lectura, por ejemplo auth, reportes o cocina.

## Resumen por modulo

| Paso | Modulo | Backend | Frontend | Estado | Trabajo pendiente |
| --- | --- | --- | --- | --- | --- |
| 1 | Diagnostico de pantallas | Revisado | Revisado | Funcional | Mantener este documento actualizado por cada correccion. |
| 2 | Navegacion y volver | No aplica | Hay volver en admin, mesero, cocina, caja e inventario; inicio respeta el rol actual | Funcional | Mantener este criterio en nuevas pantallas internas. |
| 3 | Usuarios | GET, POST, PATCH, DELETE logico con guards y auditoria | Login real; usuario se crea/edita junto al empleado | Funcional | Agregar pantalla dedicada de usuarios si se requiere gestion separada. |
| 3 | Empleados | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva empleado real | Funcional | Mantener validacion de contrasena fuerte al crear o cambiar password. |
| 3 | Clientes | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva cliente real | Funcional | Sin pendiente critico. |
| 3 | Areas del restaurante | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva area real | Funcional | Sin pendiente critico. |
| 3 | Mesas | GET, POST, PATCH, PATCH mover/asignar, DELETE logico con guards y auditoria | Mapa visual, crear, editar y desactivar mesa | Funcional | Revisar drag real en mapa si se requiere mover con arrastre. |
| 3 | Categorias y subcategorias | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva categoria real | Funcional | Sin pendiente critico. |
| 3 | Productos/platos/bebidas | GET, POST, PATCH, disponibilidad, DELETE logico con guards y auditoria | Lista, crea, edita, marca disponible/agotado, desactiva y descarga carta | Funcional | Mantener carta sincronizada con tema y visibilidad. |
| 3 | Modificadores/adicionales | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva adicional real | Funcional | Sin pendiente critico. |
| 3 | Descuentos administrativos | GET, POST, PATCH, DELETE logico con guards y auditoria | Lista, crea, edita y desactiva descuento real | Funcional | Sin pendiente critico. |
| 4 | Formularios administrativos | Servicios reales para entidades administrativas | Formularios crean, editan y desactivan datos reales por modulo | Funcional | Mantener formularios especificos cuando el flujo lo necesite. |
| 5 | Mesas visuales y mapa | API real de mesas y areas | Figuras por forma/estado y seleccion tactil | Funcional | Confirmar comportamiento responsive despues de cambios de navegacion. |
| 6 | Ordenes por mesa | Abrir orden, agregar, editar, cancelar, enviar cocina, pedir cuenta | Mesero opera mesas, productos reales y orden activa | Funcional | Verificar permisos finos para cancelaciones segun rol. |
| 7 | Menu/carta | Menu disponible/publico/admin con flags de visibilidad | Mesero ve disponibles; admin descarga carta | Funcional | Ningun producto agotado debe aparecer al mesero. |
| 8 | Cocina/comandas | GET tickets, PATCH ticket/item, eventos WebSocket | Kanban real con polling y acciones de estado | Funcional | Confirmar recepcion WebSocket en navegador si se requiere sin refrescar. |
| 9 | Recetas/inventario | Ingredientes y recetas CRUD; movimientos historicos | Admin crea, edita y desactiva ingredientes; editor gestiona recetas | Funcional | La pantalla dedicada de inventario puede recibir edicion directa si se desea. |
| 10 | Caja | Caja abierta/cierre, pagos, descuentos y ordenes reales | Flujo de caja real para cobrar orden | Funcional | Administracion visual de descuentos aun necesita editar/desactivar. |
| 11 | Descuentos, propinas e impuestos | Descuentos ya tienen CRUD backend; propina/impuesto se calcula en caja/config | Admin gestiona descuentos; caja calcula y guarda pagos reales | Funcional | Sin pendiente critico. |
| 12 | Reportes CSV/PDF | GET reportes reales con filtros | Tabla, filtros, CSV e impresion/PDF | Funcional | No aplica CRUD completo por ser lectura/exportacion. |
| 13 | Configuracion general | GET, POST, bulk, PATCH, DELETE logico con auditoria | Guarda configuracion real | Funcional | Verificar que cada setting afecte el flujo correspondiente. |
| 13 | Tema visual | GET publico, PATCH, logo, restaurar con guards | Aplica tema global y persiste | Funcional | Mantener aplicacion en admin, mesero, cocina, caja y carta. |
| 14 | Permisos y auditoria | Guards, roles, permisos y AuditLog en acciones criticas | AuthGate por rol | Funcional | Reejecutar seed para permisos si la base ya existia. |
| 15 | Limpieza de mocks | Sin mockData/fakeData/coming soon en runtime | Sin botones muertos detectados principales | Parcial | Revisar cada boton nuevo antes de marcar modulo como cerrado. |

## Pantallas visuales o parcialmente funcionales detectadas

1. **Inventario dedicado:** crea ingredientes, recetas y movimientos reales. La edicion/desactivacion completa ya existe en admin; puede duplicarse aqui si se decide que inventario opere sin entrar a admin.
2. **Usuarios dedicados:** el usuario se crea/edita desde empleados. Puede agregarse una seccion separada si se requiere administracion de usuarios no empleados.

## Pantallas funcionales revisadas

1. **Login:** usa `/auth/login` real.
2. **Mesero:** usa `/tables`, `/menu/available`, `/orders/*` reales.
3. **Cocina:** usa `/kitchen/tickets` y PATCH reales.
4. **Caja:** usa `/cashier/*` reales.
5. **Reportes:** usa `/reports` real y exporta CSV/PDF desde datos cargados.
6. **Tema visual:** usa `/theme/current`, `/theme`, `/theme/restore-default` reales.

## Comandos de verificacion

```bash
npm run check -w @restaurante/api
npm run check -w @restaurante/web
npm run lint -w @restaurante/api
npm run lint -w @restaurante/web
npm run test -w @restaurante/api
npm run test -w @restaurante/web
```

Para verificar mocks y botones muertos obvios:

```bash
rg -n "mockData|fakeData|coming soon|alert\\(" apps/web/src apps/api/src
rg -n "onClick=|button|form|fetch\\(|method:" apps/web/src/app
```

## Siguiente paso obligatorio

Continuar con el **paso 2: navegacion y botones de volver**. No avanzar al CRUD administrativo hasta confirmar que ninguna pantalla interna deja atrapado al usuario.
