import type { Texts } from '../i18n';

/** Spanish, the neutral one of Latin America. Not yet read by a native speaker. */
export const ES: Texts = {
  tut_roll: 'Estás sobre un dado. Guíalo: rueda, y una cara lateral queda arriba',
  tut_pair: 'Lleva el 2 junto al 2',
  tut_count: 'Dos 2 juntos, y ya se han ido con nosotros. Tantos dados como puntos: tres 3, cuatro 4',
  tut_three: 'Un 3 necesita tres. Mete el tuyo entre ellos',
  tut_carry: 'El 4 está en un lado. Mientras ruedas a lo largo de él, sigue en el lado. Acércalo y vuélcalo hacia arriba',
  tut_floor: 'Tu dado se ha ido, estás en el suelo. Desde aquí los dados se empujan. Empuja el 5 hacia los demás',
  tut_mount: 'Un rayo: aquí sube un dado. Súbete a él mientras está bajo',
  tut_seven: 'Un 1 arriba significa un 6 abajo: las caras opuestas suman siete. Dos giros, y queda arriba',
  tut_chain: 'Mientras un grupo se va, el canal está abierto. Pasa al dado vecino y súmalo al grupo: la puntuación se multiplica',
  tut_ones: 'El 1 va aparte: los unos no se juntan. Llévalo al grupo que se va',
  tut_alone: 'Todos los que iban aparte se han ido. Queda uno: el que pisas',
  tut_end: 'A partir de aquí los dados llegan solos. No dejes que el tablero se llene, o no te oiremos',
  newBest: 'Nuevo récord',
  dailyBest: 'Mejor resultado del día. La sesión del día es la misma para todos; llega una nueva a medianoche UTC',
  dailyNote: 'La sesión del día es la misma para todos. Llega una nueva a medianoche UTC',
  practiceNote: 'Partida de práctica: récord no guardado',
  notSaved: 'Almacenamiento no disponible: récord no guardado',
  hintFloor: 'En el suelo empujas los cubos',
  hintMount: 'Súbete a un cubo que aparece',
  hintChain: 'Añade cubos iguales mientras se hunden',
  hintOne: 'Lleva un 1 a una cadena y desaparecen todos los demás 1',
  hintLow: 'Puedes rodar por encima de un cubo transparente',
  customNote: 'Variables cambiadas: récord no guardado',
  tier_intro: 'Primeros pasos',
  tier_path: 'El camino largo',
  tier_decoy: 'Pareja falsa',
  tier_pair: 'Dos grupos',
  tier_big: 'Un grupo grande',
  tier_tight: 'Apretado',
  tier_hard: 'Difíciles',
  puzzleHeld: 'El grupo está hecho. Pasa a un dado vecino y desaparecerá',
  deadNoExit: 'Sin salida: no hay dado al que pasar y aún quedan dados. Deshaz el movimiento',
  deadSingle: 'Sin salida: quedaría un solo dado, sin pareja posible. Deshaz el movimiento',
  puzzleRule1: 'Un paso a un dado vecino no cuesta nada. Rodar tu dado a una casilla vacía es un movimiento',
  puzzleRule2: 'Junta tantos dados con el mismo número arriba como indica ese número: dos 2, tres 3. Los unos no se juntan',
  puzzleRule3: 'Un grupo completo espera mientras estás sobre él. Pasa a un dado vecino y el grupo desaparece',
  puzzleRule4: 'El sello de la esquina muestra las caras del dado que pisas: dice qué cara subirá al rodar',
  puzzleRule5: 'Retira todos los dados. Cuantos menos movimientos, más estrellas',
  levelStuck: 'Sin salida: quedan {left} en el tablero, y un combo pide {need}',
  levelStranded: 'Sin salida: desde este dado no hay adónde ir',
  levelShort: 'Se acabaron los movimientos. Faltaron: {short}',
  lessonThrees:
    '¡Hola! Te doy la bienvenida a Visual Interconnection. Soy el ayudante del laboratorio, y hoy te enseño a trabajar con la mesa.\n\n' +
    'En los años treinta, el doctor Rhine pedía a la gente que tirara dados y deseara con todas sus fuerzas la cara que quería. Nosotros no tiramos los dados. Los guiamos.\n\n' +
    'Estás de pie sobre un dado. Guíalo por la flecha: rodará, y otra cara quedará arriba.\n\n' +
    'Hoy está abierto el tercer canal: trabajamos con treses. Pon tres 3 juntos: eso es un combo, y se irá. Otras combinaciones no funcionan: sus caras están tachadas.',
  lessonStep:
    '¡Lo lograste! Los dados de Rhine solo caían. Los tuyos ya te hacen caso.\n\n' +
    'Ahora, los pasos. Puedes caminar por los dados, de uno al de al lado. Un paso no cuenta como movimiento: camina cuanto quieras.\n\n' +
    'Un movimiento es rodar. Solo rueda el dado sobre el que estás, y solo hacia un lugar libre. Llega al dado que necesitas y junta los treses.',
  lessonWalk:
    'Ahora, los pasos. Puedes caminar por los dados, de uno al de al lado. Un paso no cuenta como movimiento: camina cuanto quieras.\n\n' +
    'Un movimiento es rodar. Solo rueda el dado sobre el que estás, y solo hacia un lugar libre.\n\n' +
    'Un combo no se va enseguida, y también puedes caminar por los dados que se van. Pasa por ellos hasta los demás y junta el segundo combo.',
  lessonLink:
    'Un combo no se va enseguida. Tiene dos movimientos: en el primero los dados se hunden a medias; en el segundo, del todo.\n\n' +
    'Aquí hay cuatro dados, y un 3 pide tres. El que sobra se quedará solo, y eso es un callejón sin salida. Así que hay que acercarlo a tiempo a los que se van.\n\n' +
    'Por los dados que se van se camina como por los demás. Llega por ellos al cuarto y acércalo al combo con el 3 arriba. Esto se llama cadena.\n\n' +
    'Y un regalo de la mesa: cada dado que entra en la cadena les da a los que se van un movimiento más.',
  lessonHold:
    'Un combo que se va tiene dos movimientos. Pero cada dado que entra en la cadena le da un movimiento más.\n\n' +
    'Lo acercaste en el primer movimiento: el combo vuelve a tener dos. En el segundo: uno. Acerca un dado en cada movimiento, y esperará.',
  lessonFloor:
    'Si el dado bajo tus pies se va, quedarás en el suelo. No pasa nada: [te esperamos]. También puedes bajar tú mismo de un dado que se va.\n\n' +
    'Desde el suelo, los dados se empujan. Un dado empujado se desliza una casilla y no gira. Empujar es un movimiento.\n\n' +
    'Para volver arriba: por un dado que se va, mientras siga ahí. O por uno que no se puede empujar: detrás tiene el borde de la mesa u otro dado.',
  lessonClimb:
    'Del suelo se puede volver arriba. Súbete a un dado que se va, mientras siga ahí.\n\n' +
    'O a un dado que no se puede empujar: detrás tiene el borde de la mesa u otro dado. Y desde una casilla junto a un combo que se va subes a cualquier dado de al lado.',
  lessonSeven:
    'Un secreto que conoce todo jugador de dados: las caras opuestas suman siete. Frente al 1 está el 6, frente al 2 el 5, frente al 3 el 4.\n\n' +
    'Ves un 4 arriba: entonces el 3 está abajo. No lo ves, pero está ahí.\n\n' +
    'Dos giros hacia el mismo lado, y la cara de abajo queda arriba.',
  lessonTwos:
    'El curso de introducción terminó. Felicitaciones: la mesa te hace caso.\n\n' +
    'Desde aquí hay un canal más abierto. Ahora [se aceptan] doses y treses: un 2 pide dos dados, un 3 pide tres.\n\n' +
    'Cuenta los dados de antemano: ¿para qué combos alcanzan?',
  lessonGlass:
    'Un dado que se va [ya está medio aquí]. Por eso puedes rodar por encima: tu dado ocupará su lugar.\n\n' +
    'Si la cara coincide, tu dado entra en la cadena. Si no, simplemente ocupa el lugar.',
  lessonFives:
    'Está abierto el quinto canal. Trabajamos solo con cincos.\n\n' +
    'Pon cinco 5 juntos: eso es un combo, y se irá [con nosotros].',
  lineCombo: '¡Hola! Soy el ayudante del laboratorio. Hoy está abierto el tercer canal: pon tres 3 juntos: eso es un combo, y se irá.',
  lineStep: '¡Lo lograste! Los dados de Rhine solo caían, y los tuyos te obedecen. Puedes caminar por ellos: un paso no es un movimiento.',
  lineWalk: 'Un combo no se va de golpe: va allá, bajo la superficie. Mientras está aquí, camina por él hasta los demás.',
  lineSide: 'El curso terminó: la mesa te obedece. Ahora, un secreto de jugadores: la cara del costado viaja contigo. Llévala y gira.',
  lineSeven: 'El segundo secreto: las caras opuestas suman siete. Bajo el 4 está el 3. No lo ves, pero está ahí.',
  lineLink: '¿Más dados de los que pide el combo? Acerca el que sobra a los que se van, mientras estén aquí. Eso es una cadena.',
  lineFloor: 'De un dado que se va puedes bajar al suelo. No pasa nada: [te esperamos]. Desde el suelo los dados se empujan.',
  lineGlass: 'Un dado que se va [ya está medio aquí]. Puedes rodar por encima: el tuyo ocupa su lugar.',
  lineFaces: 'Se abrió un canal más: ahora [se aceptan] doses y treses. Cuenta los dados antes.',
  ruleThrees: 'Un combo son tres 3 juntos: se va. Solo funcionan los treses; las demás caras están tachadas.',
  ruleStep: 'Un paso por los dados no es un movimiento. Un movimiento es rodar el dado sobre el que estás hacia un lugar libre.',
  ruleWalk: 'Un paso no es un movimiento; un movimiento es rodar. Por un combo que se va puedes caminar y bajar de él a otro dado.',
  ruleLink: 'Un combo se va en dos movimientos. Acércale un dado con la misma cara: eso es una cadena. Cada dado así les da a los que se van un movimiento más.',
  ruleHold: 'Cada dado de una cadena le da al combo que se va un movimiento más.',
  ruleFloor: 'El dado bajo tus pies se fue: estás en el suelo. Desde el suelo un dado se empuja: se desliza sin girar, y eso es un movimiento. Arriba: por un dado que se va o por uno que no se puede empujar.',
  ruleClimb: 'Del suelo hacia arriba: a un dado que se va, o a uno que no se puede empujar.',
  ruleSeven: 'Las caras opuestas suman siete: 1 y 6, 2 y 5, 3 y 4. Dos giros hacia el mismo lado, y la cara de abajo queda arriba.',
  ruleTwos: 'Funcionan doses y treses. Un 2 pide dos dados; un 3, tres.',
  ruleGlass: 'Puedes rodar por encima de un dado que se va. Si la cara coincide, el dado entra en la cadena.',
  ruleFives: 'Solo funcionan los cincos. Un combo son cinco 5 juntos.',
  shellProtocol: 'SESIÓN SIN LÍMITE',
  shellLimited: 'SESIÓN DEL DÍA {time}',
  shellLevels: 'LIMPIEZA DEL CAMPO',
  shellExercise: 'PRUEBA DE HABILIDAD',
  shellTasks: 'LIMPIEZA DEL CANAL',
  shellRecords: 'REGISTRO DE SESIONES',
  shellSystem: 'PARÁMETROS',
  shellHowTo: 'PROCEDIMIENTO',
  shellReadme: 'NOTA ADJUNTA',
  howRoll: 'Estás sobre un dado y lo haces rodar: una cara lateral queda arriba.\nA una casilla vacía el dado rueda contigo. A un dado vecino simplemente pasas.\nLas caras opuestas suman siete: bajo un 1 hay un 6.',
  howCombo: 'Un combo son tantos dados juntos como puntos tiene su cara de arriba: dos 2, tres 3, seis 6.\nUn combo formado se va.',
  howChain: 'Un combo no se va enseguida.\nMientras se va, acércale otro dado con la misma cara: se irá con el combo. Esto es una cadena.',
  howOnes: 'Los 1 no forman combo.\nLleva un 1 a un combo que se va, y se irán todos los demás 1 del tablero.',
  howLevels: 'NIVELES: quita todos los dados del tablero.\nSolo funcionan las caras del nivel, las demás están tachadas.\nLos movimientos son limitados: cuantos menos hagas, más estrellas.',
  howProtocol: 'PROTOCOLO: los dados llegan solos.\nUna cadena multiplica los puntos.\nSi el tablero se llena y sigue lleno, la sesión termina.',
  shareScore: 'VI — enviado al otro lado: {score}',
};
