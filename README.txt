CLUTCHER ONLINE - MULTIJUGADOR REAL
===================================

Esta versión añade el online dentro de la partida, no solo la sala.

INICIO
------
1. Instala Node.js LTS.
2. Ejecuta Ejecutar.bat.
3. El servidor local se inicia en 0.0.0.0:8080.
4. Se abre Clutcher dentro de Electron.

LOGIN / REGISTRO
----------------
El login y el registro se hacen dentro del juego y se guardan en el servidor.

ONLINE
------
- Crear y entrar en salas.
- Contraseña opcional.
- Host y lista de jugadores.
- Mapas Oasis y Dusker.
- Deathmatch o Defusal.
- El host inicia la partida.

MULTIJUGADOR EN PARTIDA
-----------------------
Al iniciar una sala, el launcher arranca el motor de Clutcher y conecta cada jugador
al mismo servidor WebSocket.

Se sincronizan en tiempo real:
- posición X/Y/Z
- dirección de mirada
- estado vivo/muerto
- salud
- disparos
- equipos

Los jugadores remotos se representan usando los modelos/avatares del propio motor
de Clutcher. Los disparos remotos se procesan dentro del mismo motor de físicas del juego.

NOTA DE RED
-----------
Para LAN/pruebas puedes usar ws://IP_DEL_SERVIDOR:8080 en el launcher.
Para Internet se recomienda wss:// mediante TLS/reverse proxy.

EXE
---
Crear_EXE.bat crea el ejecutable portable/instalador mediante electron-builder.
