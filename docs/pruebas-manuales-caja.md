# Pruebas manuales de caja, cobro y facturacion

Estas pruebas validan el flujo real de caja conectado a backend, Prisma y PostgreSQL.

Antes de empezar:
- Backend corriendo en `http://localhost:4000`.
- Frontend corriendo en `http://localhost:3005`.
- Existe al menos un usuario con rol `CASHIER`, `ADMIN`, `MANAGER` o `SUPER_ADMIN`.
- Existe al menos una mesa con pedido real y productos agregados para probar cobro.

## Prueba 1: Caja cerrada

1. Iniciar sesion como cajera o admin.
2. Entrar a `/caja` sin una caja abierta.

Resultado esperado:
- Debe mostrar el panel `Abrir caja`.
- No debe permitir cobrar mesas.
- Si intenta cobrar debe mostrar: `Debes abrir caja antes de cobrar.`

## Prueba 2: Abrir caja

1. Ingresar monto inicial en efectivo.
2. Presionar `Abrir caja`.

Resultado esperado:
- Se crea un registro en `cash_registers`.
- La caja queda en estado `OPEN`.
- Se registra `AuditLog` con action `cashier.cash-register.open`.
- La pantalla muestra mesas pendientes de pago si existen.

## Prueba 3: Mesa pendiente de pago

1. Entrar como mesero.
2. Abrir o continuar un pedido real.
3. Presionar `Pedir cuenta`.
4. Entrar como cajera a `/caja`.

Resultado esperado:
- La orden queda en estado `WAITING_PAYMENT`.
- La mesa queda en estado `WAITING_PAYMENT`.
- La mesa aparece en `Mesas pendientes de cobro`.

## Prueba 4: Cuenta previa

1. Seleccionar una mesa pendiente de pago.
2. Revisar el panel `Cuenta previa`.

Resultado esperado:
- Muestra mesa, mesero, productos, cantidades, subtotal, descuentos, impuestos, propina sugerida y total estimado.
- No crea pagos.
- No cambia la orden a `PAID`.
- No libera la mesa.

## Prueba 5: Cobrar efectivo

1. Presionar `Cobrar / Facturar`.
2. Ir al paso `Metodo de pago`.
3. Seleccionar `Efectivo`.
4. Ingresar monto recibido.
5. Confirmar pago.

Resultado esperado:
- Se registra `Payment` con method `CASH`.
- Calcula cambio automaticamente si el monto recibido es mayor al total.
- La orden queda `PAID`.
- La mesa queda `AVAILABLE` o `CLEANING` segun configuracion `afterPaymentTableStatus`.
- Se registra auditoria:
  - `cashier.payment.register`
  - `cashier.order.close`
  - `cashier.table.release`
- Muestra: `Pago registrado correctamente. Mesa liberada.`

## Prueba 6: Cobrar tarjeta

1. Seleccionar una mesa pendiente de pago.
2. Presionar `Cobrar / Facturar`.
3. Seleccionar `Tarjeta`.
4. Agregar referencia si aplica.
5. Confirmar pago.

Resultado esperado:
- Se registra `Payment` con method `CARD`.
- La orden queda `PAID`.
- La mesa queda liberada o en limpieza segun configuracion.
- No exige monto recibido ni cambio.

## Prueba 7: Pago mixto

1. Seleccionar `Pago mixto`.
2. Agregar una linea en efectivo.
3. Agregar una linea en tarjeta.
4. Intentar confirmar con suma incorrecta.
5. Corregir hasta que la suma coincida con el total.
6. Confirmar.

Resultado esperado:
- Si la suma no coincide, muestra: `La suma de los pagos no coincide con el total.`
- Solo permite cobrar cuando la suma coincide.
- Se registran varios `Payment`, uno por metodo.
- La orden queda `PAID` y la mesa se libera.

## Prueba 8: Propina

1. En el wizard de cobro ir al paso `Propina`.
2. Seleccionar `10%` o ingresar una propina personalizada.
3. Revisar el resumen final.

Resultado esperado:
- La propina se suma correctamente al total final.
- El total cobrado coincide con subtotal, descuento, impuesto y propina.
- La propina queda guardada en la orden.

## Prueba 9: Descuento

1. Entrar con usuario autorizado: `SUPER_ADMIN`, `ADMIN` o `MANAGER`.
2. En caja, seleccionar una orden pendiente.
3. Ir al paso `Descuento`.
4. Aplicar descuento por porcentaje o valor fijo.

Resultado esperado:
- El descuento se aplica al total.
- Se registra `AuditLog` con action `cashier.discount.apply`.
- Si el usuario no tiene permiso, muestra: `No tienes permiso para aplicar descuentos.`

## Prueba 10: Mesa liberada

1. Confirmar pago completo de una mesa.
2. Volver a vista de mesas o pedidos.

Resultado esperado:
- La orden queda en estado `PAID`.
- La mesa queda `AVAILABLE` o `CLEANING`, segun `afterPaymentTableStatus`.
- La mesa ya no debe seguir marcando tiempo de servicio activo.

## Prueba 11: No doble cobro

1. En el ultimo paso de cobro, presionar dos veces rapidamente `Confirmar pago y cerrar mesa`.

Resultado esperado:
- El boton se bloquea mientras procesa.
- Solo se registra un cobro.
- Si vuelve a intentar cobrar la misma orden, muestra: `Esta cuenta ya fue pagada.`

## Prueba 12: Reportes

1. Cobrar una orden real.
2. Entrar a reportes administrativos.
3. Revisar ventas del dia.

Resultado esperado:
- La venta aparece en reportes del dia.
- Deben verse metodo de pago, total, descuentos y cierre de caja si aplica.

## Consulta SQL util para verificar auditoria

```sql
SELECT action, entity, entity_id, created_at
FROM audit_logs
WHERE action LIKE 'cashier.%'
ORDER BY created_at DESC;
```

## Consulta SQL util para verificar pago y mesa

```sql
SELECT o.id, o.status AS order_status, rt.name, rt.number, rt.status AS table_status
FROM orders o
JOIN restaurant_tables rt ON rt.id = o.table_id
ORDER BY o.created_at DESC;
```
