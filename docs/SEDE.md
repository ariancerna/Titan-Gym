# Sede única · TITAN GYM QATUNA

La referencia `image.png`, proporcionada por el propietario e inspeccionada el 11 de octubre de 2026, muestra:

- Nombre: **TITAN GYM QATUNA**.
- Dirección: **Isabel Chimpu Ocllo cdra 10, Carabayllo 15318**.

Se sustituyeron los datos académicos de tres sedes por una única sede. La migración `20261011232425_single_qatuna_location.sql` actualiza la sede principal y reasigna las sesiones antes de retirar las filas académicas Sede Norte y Sede Financiera. No elimina clases, sesiones, alumnos ni reservas. El proyecto alojado conservó ocho sesiones y 89 reservas después de la operación.

Las dos filas retiradas eran datos de demostración, no sucursales reales. Sus nombres, direcciones e identificadores anteriores se conservan en el historial Git del seed; pueden consultarse para una recuperación administrativa. No se recomienda volver a ejecutarlo sobre la base alojada ni restaurar esas sedes para la demostración actual.

El seed actualizado crea una sola sede y todas sus sesiones la utilizan. Inicio consulta `locations` independientemente del catálogo, de modo que la dirección sigue visible incluso cuando no hay sesiones publicadas. Catálogo, detalle, reserva, comprobante y administración utilizan esa misma sede persistida.

La captura de referencia permanece local y no se publica como recurso del frontend ni como evidencia de ejecución de la aplicación. No se copiaron de ella valoraciones, estado «Abierto», horarios comerciales o afirmaciones que pueden cambiar. Las fotografías de entrenamiento conservan su procedencia en [Recursos visuales](RECURSOS_VISUALES.md).
