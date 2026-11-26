# Manual de usuario · FitSmart Agenda (TITAN GYM)

Para el administrador y el personal de recepción. Versión del Proyecto Final (modelo proy-1.0).

## 1. Para qué sirve

FitSmart Agenda reemplaza el cuaderno y los mensajes de WhatsApp para las clases grupales. Los socios reservan su cupo desde el celular y el sistema nunca deja pasar el aforo. Recepción ve quién está inscrito, registra la asistencia y recibe una **alerta de riesgo de no-show**: la probabilidad, calculada por un modelo de Machine Learning, de que un socio no llegue sin avisar. Con esa alerta se confirma a tiempo y, si el socio no responde, el cupo pasa a la lista de espera.

**Entrar:** https://titan-gym-tau.vercel.app → menú de la cuenta → **Panel** (solo cuentas autorizadas como administrador).

## 2. Rutina diaria

| Momento | Dónde | Qué hacer |
| --- | --- | --- |
| Al abrir | Panel → **Hoy** | Ver las clases del día, sus inscritos y los cupos libres. Si aparece el aviso amarillo **«asistencia sin registrar»**, pulsar **Registrar asistencia** en cada clase indicada. |
| Antes de cada clase | Panel → **Agenda** → la clase → **Ver inscritos** | Revisar la tabla de riesgo (sección 3). Confirmar por WhatsApp a los socios en **riesgo alto**. |
| Cuando llega un socio | Panel → **Hoy** → **Registrar llegada** | Escanear el QR de su comprobante (o escribir el código TG-…). |
| Después de la clase | **Ver inscritos** | Marcar **Presente** o **Ausente** a quien falte por registrar. Registrar la asistencia de todas las clases es lo que permite medir el indicador y reentrenar el modelo. |
| Una vez por semana | Panel → **Indicadores** | Ver el porcentaje de no-shows y si el riesgo alto falta más que el bajo. |

Crear o cambiar clases: **Agenda → Nueva sesión** (también semanal) y **Catálogo** para clases e instructores. Si hay que cancelar una sesión, **Cancelar sesión** pide un motivo y avisa por correo a los inscritos.

## 3. Cómo leer el riesgo de no-show

En **Ver inscritos** cada socio aparece en una fila, del riesgo más alto al más bajo:

| Riesgo | Qué significa | Qué hacer |
| --- | --- | --- |
| **Alto** | Entre los socios con más probabilidad de faltar (como máximo 1 de cada 5 reservas). | Escribirle por WhatsApp para confirmar. Si no confirma antes de la clase, ofrecer el cupo a la lista de espera. |
| **Medio** | Riesgo algo mayor que el habitual. | Recordatorio adicional solo si hay tiempo. |
| **Bajo** | Lo más probable es que asista. | Nada. |

- El **porcentaje** es la probabilidad estimada de que no llegue sin avisar; los **motivos** explican por qué (por ejemplo, «faltó sin avisar a 3 de sus 6 reservas anteriores», «clase antes de las 8:00»).
- El modelo **ayuda a decidir a quién escribir; no decide**. Nunca se cancela ni se niega una reserva por el riesgo. Puede equivocarse: un socio cumplido puede faltar y uno con faltas puede llegar.
- El modelo se entrenó con datos simulados; se reentrenará con la asistencia real que se registre aquí.

## 4. Servicio de predicción (Indicadores)

- **Estado:** «Activo · proy-1.0» indica que el modelo está funcionando en el servidor.
- **Probar una predicción:** se ingresa una reserva de ejemplo y se pulsa **Calcular riesgo en el servidor**. Si un dato está fuera de rango (por ejemplo, más faltas que reservas), el servidor lo rechaza con un mensaje y no lo registra.
- **Últimas predicciones registradas:** cada predicción guarda la fecha, la versión del modelo, los datos usados y el resultado. Sirve para revisar cualquier alerta mostrada.
- **Desactivar modelo:** solo para pruebas o si el modelo da resultados extraños. Mientras está desactivado, el panel usa la regla de respaldo.

## 5. Si algo falla

| Situación | Qué se ve | Qué hacer |
| --- | --- | --- |
| El modelo no responde, tarda más de 6 s o está desactivado | Aviso amarillo «Servicio de predicción no disponible» y «Regla de respaldo» en la columna Riesgo. | Seguir trabajando: el riesgo por reglas sirve para priorizar. Pulsar **Reintentar** más tarde y avisar al responsable técnico. |
| Un dato del formulario es inválido | Mensaje rojo «El servidor rechazó los datos: …». | Corregir el dato indicado y volver a calcular. |
| La página no carga | Error del navegador. | Revisar internet; si sigue, anotar llegadas en papel y registrarlas después en **Ver inscritos**. |
| Un socio no tiene su QR | — | Buscar su nombre en **Ver inscritos** y marcarlo Presente. |

## 6. Privacidad (Ley N.° 29733)

Los datos de los socios solo se usan para gestionar sus reservas y analizar las inasistencias. El modelo y su registro no guardan nombres ni correos. No compartir capturas con datos de socios fuera del gimnasio; los socios pueden pedir el acceso, la rectificación o la cancelación de sus datos (ver /privacidad).

## 7. Para el socio (resumen)

Reservar en **Clases** → la clase → **Reservar**; el comprobante con QR queda en **Mis reservas**, donde también se cancela antes del inicio. Llega un recordatorio por correo 3 horas antes (se puede desactivar en **Mi perfil**). Si la clase está llena, puede unirse a la **lista de espera**.
