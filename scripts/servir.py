# -*- coding: utf-8 -*-
"""
Pokémon Libre · servidor para probar en la red local

Sirve la app a todos los dispositivos de la misma wifi, sin caché
(para que cada cambio se vea al recargar) y con el tipo correcto
para los .webp, que el servidor de Python no siempre conoce.

    python scripts/servir.py            puerto 8401
    python scripts/servir.py 9000       otro puerto

Aviso: en http:// desde otra máquina el navegador no permite instalar
la app ni el modo sin conexión (exige https). Para eso está la
dirección publicada. Aquí se prueba la interfaz y el uso.
"""

import http.server
import mimetypes
import os
import socket
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8401

mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('application/manifest+json', '.webmanifest')


class SinCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # solo errores; las 1.700 imágenes llenarían la consola de ruido
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


def ip_local():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    servidor = http.server.ThreadingHTTPServer(('0.0.0.0', PUERTO), SinCache)
    print(f'Pokémon Libre servida en:')
    print(f'   este equipo   http://localhost:{PUERTO}/')
    print(f'   tu móvil      http://{ip_local()}:{PUERTO}/   (misma wifi)')
    print('Ctrl+C para parar.')
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
