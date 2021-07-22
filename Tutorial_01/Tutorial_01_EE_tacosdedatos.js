/*
Este archivo es parte del artículo de Medium: "Ver el mundo desde tu casa: 
Tutorial introductorio a las imágenes satelitales", publicado en tacosdedatos en Medium.
Estas invitado a leer el tutorial completo junto con las explicaciones más detalladas, el link se puede encontrar
en el README.md de este respositorio.

Nota importante: Este archivo no se podrá ejecutar correctamente ya que se tiene que tener
acceso a Earth Engine Code Editor, para poder crear los polígonos de las Regiones de Interés.

Autor: Isaac Arroyo (@unisaacarroyov en Instagram, Twitter y Medium)

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

This file is part of the Medium's article "Ver el mundo desde tu casa: 
Tutorial introductorio a las imágenes satelitales" (in english: See the world from your house,
Introductory tutorial to satellite imagery), published in tacosdedatos (a Medium's Publication).
If you are interested in reading the full tutorial with all the explanations, there's a link in the 
repository's README.md file to the Medium's artcile.

Important note: This file should not be executed, to do so, you need an Earth Engine Account. This
file needs the ee.Geometry objects of the Region of Interest.

Author: Isaac Arroyo (@unisaacarroyov in Instagram, Twitter & Medium)

*/


// -> Importamos los data sets de nuestro interes
// Temperatura de la superficie
var Datos_Temperatura = ee.ImageCollection("MODIS/006/MOD11A1");

// Precipitacion del agua (5 dias)
var Datos_Lluvias = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD");

// Deforestacion
var Datos_Bosques = ee.Image('UMD/hansen/global_forest_change_2020_v1_8');


//- - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// -> Creamos nuestros filtros
// Region de interes - Punto -> (RdI): Cerca de Santarem, Brasil
// Region de interes - poligono -> (RdI_Poligono): Cubriendo Santarem, Brasil
// Filtro por Fecha
var Inicio_Fecha = '2016-01-01';
var Fin_Fecha = '2020-12-31';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// -> Filtramos por fecha
// Temperatura de la superficie
var Temperatura_FiltroFecha = Datos_Temperatura.filterDate(Inicio_Fecha, Fin_Fecha)
                              // Seleccionamos la banda de interes
                              .select(['LST_Day_1km']);

// Precipitacion del agua
var Lluvias_Final = Datos_Lluvias.filterDate(Inicio_Fecha, Fin_Fecha)
                    // Seleccionamos banda de interes
                    .select(['precipitation']);


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// -> Obtenemos datos en forma de graficas 
// TEMPERATURA DE LA SUPERFICIE
// Creamos una funcion que transforma de Kelvin a grados Celsius
var func_kelvin_a_celsius = function(image){
  var Escalar = image.multiply(0.02);
  var aCelsius = Escalar.subtract(273.15);
  var Final = aCelsius.copyProperties(image, ['system:time_start']);
  return Final;
};

var Temperatura_Final = Temperatura_FiltroFecha.map(func_kelvin_a_celsius);

// Graficamos 

var Plot_TempFinal = ui.Chart.image.series(
  // Diccionario de argumentos
  {
    // Coleccion de imagenes a extraer información
    imageCollection: Temperatura_Final,
    
    // Región de interés (una geometría)
    region: RdI_Poligono,
    
    // Reductor a usar
    reducer: ee.Reducer.median(),
    
    // Escala 
    scale: 1000,
    
    // Prpiedad o valor en el eje x
    xProperty: 'system:time_start'
  }
);
print("Temperatura a traves del tiempo");
print(Plot_TempFinal);


// PRECIPITACION DEL AGUA
var Plot_Lluvias = ui.Chart.image.series(
  Lluvias_Final,
  RdI_Poligono,
  ee.Reducer.mean(),
  1000,
  'system:time_start');

print("Precipitacion del agua (mm/5day)");
print(Plot_Lluvias);

// DEFORESTACION 
// Seleccionamos la banda de perdidas
var BosquesPerdidos = Datos_Bosques.select(['loss']);

// Seleccionamos la banda de perdidas por año
var BosquesPerdidos_Year = Datos_Bosques.select(['lossyear']);

// Calculamos el area de los bosques perdidos (m2)
var AreaBosquesPerdidos = BosquesPerdidos.multiply(ee.Image.pixelArea());

print("Ver sobre que banda o grupo reducir")
print(AreaBosquesPerdidos.addBands(BosquesPerdidos_Year));

// Calculamos el area de los bosques perdidos por cada año:
                              // Agregamos la banda de perdida por año
var AreaBosquesPerdidos_Year = AreaBosquesPerdidos.addBands(BosquesPerdidos_Year)
                              // Vamos a reducir el calculo a nuestra RdI_Poligono
                              .reduceRegion({
                                // el reductor sera la suma de bosques perdidos
                                // y este reductor se aplicara por grupo (el año)
                                reducer: ee.Reducer.sum().group({groupField: 1}),
                                // reducimos en nuestra area de interes
                                geometry: RdI_Poligono,
                                // escala nominal de metros de la proyeccion a reducir
                                scale: 30,
                                maxPixels: 1e9
                              });

// -> Hacemos un mejor formato

// 1.- Creamos una lista con listas de tuplas (año y area perdida)
                          // extraemos la lista de diccionarios
var FormatoEstadisticas = ee.List(AreaBosquesPerdidos_Year.get('groups'))
                          // a cada elemento (un diccionario)
                          .map(function(element){
                            // lo convertimos en un ee.Dictionary
                            var d = ee.Dictionary(element);
                            // array de año y area perdida
                            var Year_Area = [
                              // convertimos en numero para luego hacer
                              // formato de año
                              ee.Number(d.get('group')).format("20%02d"),
                              // area perdida
                              d.get('sum')
                              ];
                            return Year_Area;
                          });
print("estadisticas como un array (con 20 elemetos) de arrays (de 2 elementos)")
print(FormatoEstadisticas)

// 2.- Ahora vamos a trasformar todo en un diccionario de estadisticas
var Dict_PerdidasAnualesBosques = ee.Dictionary(
  // Pasamos de una lista de 20 sublistas (de 2 elementos)
  // a una lista de 40 elementos (primero string de año y luego area afectada)
  FormatoEstadisticas.flatten()
  );

// 3.- Crear el plot con arreglos
var Plot_PerdidasAnualesBosques = ui.Chart.array.values({
  array: Dict_PerdidasAnualesBosques.values(),
  axis: 0,
  xLabels: Dict_PerdidasAnualesBosques.keys()
});
print("Perdidas de bosques por año (m2)")
print(Plot_PerdidasAnualesBosques);

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// Visualizamos los mapas

// Centramos nuestro mapa
Map.centerObject(RdI_Poligono,8);

// TEMPERATURA DE LA SUPERFICIE
// -> Parametros de visualizacion
var VisParams_Temperatura = {
  min: 25,
  max: 35,
  palette:['blue', 'limegreen', 'yellow', 'darkorange', 'red']
  
};
// Visualizar solo en nuestra Region de Interes
var ImageMap_Temperatura = Temperatura_Final.median().clip(RdI_Poligono);
Map.addLayer(ImageMap_Temperatura, VisParams_Temperatura, 'Temperatura (2016-2020)');

// PRECIPITACION DEL AGUA
// -> Parametros de visualizacion
var VisParams_Lluvias = {
  // valor minimo
  min: 15,
  
  // valor maximo
  max: 30,
  
  // paleta de colores
  palette: ['00B4D8','0096C7','0077B6','023E8A','03045E']
};
// Visualizar solo en nuestra Region de Interes
var ImageMap_Lluvias = Lluvias_Final.median().clip(RdI_Poligono);
Map.addLayer(ImageMap_Lluvias, VisParams_Lluvias, 'Precipitacion del agua (mm/5day)');



// ESTADO DE LOS BOSQUES EN EL 2000
// Seleccionar bandas con parametros de visualizacion (sin mascara)
var VisParams_Bosques2000_NoMask = {
  palette: ['black','green'],
  bands: ['treecover2000']
};
Map.addLayer(Datos_Bosques.clip(RdI_Poligono),
VisParams_Bosques2000_NoMask, 'Situacion en el 2000 (sin máscara)' );

// Seleccionar bandas en variable nueva
var ImageMap_Bosques2000_band = Datos_Bosques.select('treecover2000');
// Enmascarar en variable nueva
var ImageMap_Bosques2000_Final = ImageMap_Bosques2000_band
                                .mask(ImageMap_Bosques2000_band)
                                .clip(RdI_Poligono);
var VisParams_Bosques2000 = {
  min: 0,
  max: 100,
  palette: ['B7EFC5','6EDE8A','2DC653','208B3A','155D27']
};
Map.addLayer(ImageMap_Bosques2000_Final,
VisParams_Bosques2000, 'Situacion en el 2000 (con máscara)' );


// PERDIDA GENERAL DE LOS BOSQUES
var VisParams_BosquesPerdidos = {palette: ['e5383b']};
var ImageMap_BosquesPerdidos = BosquesPerdidos.mask(BosquesPerdidos)
                              .clip(RdI_Poligono);
Map.addLayer(ImageMap_BosquesPerdidos,
VisParams_BosquesPerdidos,
'Perdida general de bosques (a partir del 2001 hasta 2020)');

// GANANCIA GENERAL DE LOS BOSQUES
// Seleccionar bandas en variable nueva
var BosquesGanados_NoMask = Datos_Bosques.select(['gain']);
var BosquesGanados = BosquesGanados_NoMask
                    .mask(BosquesGanados_NoMask)
                    .clip(RdI_Poligono);

var VisParams_BosquesGanados = {palette:['blue']};

Map.addLayer(BosquesGanados,
VisParams_BosquesGanados,
'Ganancia de bosques (a partir del 2001 hasta el 2020)');

// PERDIDA BIENIAL DE LOS BOSQUES
var BosquesPerdidos_Year_Map = BosquesPerdidos_Year.clip(RdI_Poligono);
var VisParams_BosquesPerdidos_Year = {
  min: 0, 
  max: 20,
  palette: ['001219', '005f73', '0a9396',
  '94d2bd', 'e9d8a6','ee9b00', 'ca6702',
  'bb3e03', 'ae2012', '9b2226']
};

Map.addLayer(BosquesPerdidos_Year_Map,VisParams_BosquesPerdidos_Year, 
'Perdidas de bosques bienal (cada 2 años)');