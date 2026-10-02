# Integración de IA del campus con tu proyecto Python

1. Ejecuta `supabase/migrations/20261002_ia.sql` completo en Supabase → SQL Editor → Run.
2. Recarga el campus, muestra el dragón con Ctrl + Alt + H y abre sus ajustes con clic derecho. El valor (0–100) solo se guarda, no controla aún un efecto. ChatGPT y Gemini son proveedores; la versión concreta del modelo depende del chat que abra Python.
3. El clic izquierdo abre el chat. Los mensajes se guardan en `public.ia_mensajes`; la web consulta las respuestas cada 3 segundos mientras está abierto. Se muestran los últimos 50; el resto permanece en la base de datos.

## Tablas

- `ia_preferencias`: `usuario_id`, `modelo` (`chatgpt` / `gemini`), `valor`, `actualizado_en`.
- `ia_mensajes`: `id`, `usuario_id`, `modelo`, `valor`, `prompt`, `respuesta`, `estado`, `error`, `creado_en`, `iniciado_en`, `terminado_en`, `token_trabajo`.
- Estados: `pendiente` → `procesando` → `completado` o `error`.
- Cada usuario solo puede leer sus preferencias y mensajes. El navegador no puede escribir respuestas ni cambiar estados.

## Contrato para Python

Tu proceso Python debe usar una clave de servidor de Supabase (`service_role`), guardada en una variable de entorno del proceso. Nunca la pongas en React, GitHub ni en el navegador: la clave pública del campus no permite reclamar trabajos o guardar respuestas.

Con el cliente Python de Supabase, el flujo a integrar en tu proyecto es:

```python
# `supabase` aquí es tu cliente de servidor ya configurado.
trabajos = supabase.rpc("ia_tomar_siguiente", {"p_modelo": None}).execute().data
if trabajos:
    trabajo = trabajos[0]
    # Aquí tu proyecto abre el chat indicado por trabajo["modelo"]
    # y envía trabajo["prompt"]. El valor está en trabajo["valor"].
    # La respuesta debe provenir de tu integración real.
    respuesta = obtener_respuesta_con_tu_integracion(trabajo)
    confirmado = supabase.rpc("ia_finalizar", {
        "p_id": trabajo["id"],
        "p_token": trabajo["token_trabajo"],
        "p_respuesta": respuesta,
        "p_error": None,
    }).execute().data
    if not confirmado:
        raise RuntimeError("El trabajo no está activo o no coincide su token")
```

`obtener_respuesta_con_tu_integracion` es un marcador para tu código existente, no una función incluida. Puedes usar `p_modelo: "gemini"` o `"chatgpt"` si tienes un proceso por proveedor.

Si tu integración falla, llama `ia_finalizar` con el mismo `p_id` y `p_token`, `p_respuesta: None` y `p_error` con una explicación sin claves ni datos sensibles.

La reclamación usa una transacción con `FOR UPDATE SKIP LOCKED`. No hay reenvíos automáticos a Chrome: si Python se cierra después de reclamar un mensaje, este permanece en `procesando`. Conserva su ID y token para continuar o marcarlo como error. Antes de reenviar, verifica si el prompt ya llegó al chat externo para evitar duplicados. Cada fila identifica una petición y respuesta; la continuidad de la conversación en Chrome la gestiona tu proyecto Python.

El SQL no inicia Python ni abre Chrome. Sin conectar ese proceso, los prompts permanecerán en «Esperando a Python».
