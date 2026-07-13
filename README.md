# ENERGÉTICOS · Datos para Diseño Solar

Aplicación web progresiva (PWA) para instalar en celulares y recopilar la información técnica que el cliente debe proporcionar antes de elaborar el diseño y la cotización preliminar de un sistema fotovoltaico.

## Identidad incorporada

- **Marca:** ENERGÉTICOS · Servicios del Sector Eléctrico
- **Razón social:** Corporación RyC Contratistas Generales S.A.C.
- **RUC:** 20533666273
- **Responsable técnico:** Ing. José Rafael Zeña Peche
- **Profesión:** Ingeniero Mecánico Electricista
- **CIP:** 85540
- **WhatsApp:** +51 942 899 919
- **Correo:** energeticos.ryc@gmail.com
- **Dirección:** Jr. Augusto B. Leguía 563, Independencia, Huaraz, Áncash

## Funciones principales

- Instalación en Android y iPhone como PWA.
- Funcionamiento sin conexión después de la primera carga.
- Registro de cliente, ubicación GPS y enlace de Google Maps.
- Selección de sistema autónomo, conectado a red, híbrido o bombeo solar.
- Datos de suministro eléctrico, recibo, medidor y tablero.
- Inventario de cargas con cálculo referencial de potencia y energía diaria.
- Datos de techo, sombras, área, orientación y distancia al tablero.
- Formulario especializado para bombeo solar.
- Captura y almacenamiento local de fotografías, incluso al cerrar la aplicación.
- Resumen listo para enviar por WhatsApp al número de ENERGÉTICOS.
- Generación de expediente ZIP con informe HTML, inventario CSV, respaldo JSON y todas las fotografías.
- Informe imprimible o guardable como PDF desde el navegador.

## Publicación en GitHub Pages

1. Cree un repositorio, por ejemplo: `ENERGETICOS-Datos-Solar`.
2. Suba **todo el contenido de esta carpeta**, conservando las carpetas `assets` e `icons`.
3. En GitHub vaya a **Settings → Pages**.
4. En **Build and deployment**, seleccione **Deploy from a branch**.
5. Seleccione la rama `main` y la carpeta `/ (root)`; luego pulse **Save**.
6. Abra el enlace publicado desde el celular.
7. En Android, pulse el botón de instalación de la aplicación o el menú del navegador → **Instalar aplicación**.
8. En iPhone, use Safari → **Compartir** → **Agregar a pantalla de inicio**.

## Consideraciones

- Los datos y fotografías se guardan localmente en el celular mediante `localStorage` e `IndexedDB`.
- La propuesta generada es preliminar y debe verificarse antes de ejecutar la instalación.
- Para que la PWA sea instalable, debe abrirse desde una dirección HTTPS, como GitHub Pages.
