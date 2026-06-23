# Pruebas manuales del modulo Pedidos

Ruta principal: `/mesero/pedidos`

## Prueba 1: Menu/sidebar
1. Iniciar sesion como usuario con rol `WAITER`.
2. Ver la barra de menu.

Resultado esperado: debe aparecer la opcion `Pedidos`.

## Prueba 2: Entrar a Pedidos
1. Hacer clic en `Pedidos`.

Resultado esperado: debe abrir `/mesero/pedidos` con areas y mesas asignadas.

## Prueba 3: Seleccionar mesa
1. Seleccionar una mesa asignada.

Resultado esperado: debajo de las mesas aparece el panel operativo de esa mesa.

## Prueba 4: Crear pedido sin productos creados
1. Seleccionar una mesa disponible.
2. Presionar `Crear pedido`.

Resultado esperado: se crea una orden real, la mesa queda ocupada y la sesion no se cae.

## Prueba 5: Abrir menu sin productos
1. Abrir la seccion `Menu` dentro del pedido.

Resultado esperado: debe mostrar `No hay productos disponibles para vender`.

## Prueba 6: Token
1. Revisar que el usuario siga autenticado despues de crear pedido o abrir menu sin productos.

Resultado esperado: no debe redirigir al login ni limpiar la sesion.

## Prueba 7: Crear producto desde admin
1. Entrar como admin.
2. Crear un producto activo y disponible.
3. Volver como mesero.

Resultado esperado: el producto aparece en el menu del pedido.

## Prueba 8: Agregar producto
1. Agregar producto al pedido.

Resultado esperado: el producto se agrega al pedido y se actualiza el total.

## Prueba 9: Enviar a cocina
1. Enviar productos pendientes.

Resultado esperado: se crea una comanda real y los productos pasan a enviados.

## Prueba 10: Pedir cuenta
1. Solicitar cuenta.

Resultado esperado: mesa y orden pasan a cuenta solicitada.

## Verificacion ejecutada

Fecha: 2026-05-27.

Resultado: pruebas operativas verificadas contra API real `http://localhost:4000` y PostgreSQL.

Datos generados durante la verificacion:
- Mesero: `3f63dbf4-e405-4676-be73-ba5bea6a5c17`
- Mesa: `ad76ed69-a6e2-4c16-9c78-9ac489e0a305`
- Orden: `1fced6a5-e874-47dd-bdbc-3b84f07dccf5`
- Producto: `360cc751-431f-4110-a2c3-67a439371d16`

Checks confirmados:
- `/waiter/tables` devuelve la mesa asignada al mesero.
- `/menu-items/available` devuelve lista vacia con mensaje controlado cuando no hay productos disponibles.
- `POST /orders/open-table` crea pedido aunque el menu este vacio.
- La sesion no se limpia por menu vacio.
- Producto creado desde admin aparece en el menu operativo del mesero.
- `POST /orders/:orderId/items` agrega producto y actualiza total.
- `POST /orders/:orderId/send-to-kitchen` crea comanda real y pasa items a `SENT`.
- `PATCH /orders/:orderId/request-payment` pasa la orden a `WAITING_PAYMENT`.

Nota tecnica: se aplico la migracion pendiente `20260527000100_add_operational_table_statuses` y se regenero Prisma Client para que el backend reconozca `WAITING_KITCHEN`, `READY_TO_SERVE` y `WAITING_PAYMENT`.
