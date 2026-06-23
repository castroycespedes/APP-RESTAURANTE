# Arquitectura de impresion

La Fase 7 deja dos caminos preparados:

1. Impresion manual desde navegador con el boton `Imprimir ticket` en `/cocina/kanban`.
2. Cola backend con `PrintService`, `PrintJob` y `PrinterConfig` para impresion automatica futura.

## Impresion desde navegador

El navegador solo puede abrir el dialogo de impresion con `window.print()`. Esto funciona para imprimir tickets visibles o una version CSS optimizada para papel termico, pero normalmente requiere que el usuario confirme la impresion.

La impresion silenciosa/directa desde navegador no es confiable por seguridad. Para produccion se recomienda una de estas opciones:

- Agente local instalado en el equipo de caja/cocina.
- Impresora de red con API compatible.
- Servicio interno que consuma la cola `print_jobs` y envie comandos a la impresora.

## Cola de impresion

La tabla `print_jobs` representa trabajos pendientes o procesados.

Estados:

- `QUEUED`: trabajo listo para ser tomado por un agente.
- `PRINTING`: trabajo tomado y en proceso.
- `COMPLETED`: impresion terminada.
- `FAILED`: fallo al imprimir; puede reintentarse.
- `CANCELLED`: cancelado manualmente.

## Configuracion de impresoras

La tabla `printer_configs` permite configurar destinos por:

- `DINING_AREA`: area o salon.
- `MENU_CATEGORY`: categoria del menu.
- `KITCHEN_STATION`: estacion de cocina.

No depende de una marca especifica. Los campos `printerName` y `networkAddress` son neutros para soportar agente local, impresora de red o integracion futura.

## Endpoints base

```text
GET    /print/jobs
POST   /print/kitchen-tickets/:ticketId/jobs
PATCH  /print/jobs/:jobId/status
GET    /print/printer-configs
POST   /print/printer-configs
```

## Flujo sugerido para impresion automatica

1. Al enviar productos a cocina se crea un `KitchenTicket`.
2. El backend encola un `PrintJob` con payload normalizado.
3. Un agente local consulta `GET /print/jobs`.
4. El agente toma trabajos `QUEUED`, marca `PRINTING`, imprime y marca `COMPLETED`.
5. Si falla, marca `FAILED` con `errorMessage`.

En esta fase no se implementa comunicacion directa con impresoras fisicas para evitar depender de marca, driver o protocolo especifico.
