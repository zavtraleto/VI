/**
 * The words of the program that a player presses or reads in a panel, in the languages of the
 * player: the names of the files of the menu, the commands, the names of panels and of their
 * readings, the settings and their values. Each stands under the English word the program has
 * for it in `src/shell/text.ts`; the Japanese beside it is the program's own and stays.
 *
 * Not yet read by native speakers. A word has to fit where its English one stands:
 * `src/shell/text.test.ts` measures them.
 */
export const WORDS = {
  // The files of the menu and the bar that runs one.
  EXECUTE: { ru: 'ВЫПОЛНИТЬ', es: 'EJECUTAR', pt: 'EXECUTAR', tr: 'ÇALIŞTIR', de: 'AUSFÜHREN', fr: 'EXÉCUTER' },
  PROTOCOL: { ru: 'ПРОТОКОЛ', es: 'PROTOCOLO', pt: 'PROTOCOLO', tr: 'PROTOKOL', de: 'PROTOKOLL', fr: 'PROTOCOLE' },
  LEVELS: { ru: 'УРОВНИ', es: 'NIVELES', pt: 'NÍVEIS', tr: 'SEVİYELER', de: 'STUFEN', fr: 'NIVEAUX' },
  EXERCISE: { ru: 'УПРАЖНЕНИЕ', es: 'EJERCICIO', pt: 'EXERCÍCIO', tr: 'ALIŞTIRMA', de: 'ÜBUNG', fr: 'EXERCICE' },
  TASKS: { ru: 'ЗАДАЧИ', es: 'TAREAS', pt: 'TAREFAS', tr: 'GÖREVLER', de: 'AUFGABEN', fr: 'TÂCHES' },
  RECORDS: { ru: 'ЖУРНАЛ', es: 'REGISTROS', pt: 'REGISTROS', tr: 'KAYITLAR', de: 'LOGBUCH', fr: 'JOURNAL' },
  SYSTEM: { ru: 'НАСТРОЙКИ', es: 'AJUSTES', pt: 'AJUSTES', tr: 'AYARLAR', de: 'OPTIONEN', fr: 'RÉGLAGES' },
  'HOW TO PLAY': { ru: 'КАК ИГРАТЬ', es: 'CÓMO JUGAR', pt: 'COMO JOGAR', tr: 'OYNANIŞ', de: 'ANLEITUNG', fr: 'GUIDE' },
  README: { ru: 'ПРОЧТИ', es: 'LÉEME', pt: 'LEIA-ME', tr: 'BENİ OKU', de: 'LIESMICH', fr: 'LISEZ-MOI' },
  // The names of panels.
  PAUSE: { ru: 'ПАУЗА', es: 'PAUSA', pt: 'PAUSA', tr: 'DURAKLATILDI', de: 'PAUSE', fr: 'PAUSE' },
  RESULT: { ru: 'РЕЗУЛЬТАТ', es: 'RESULTADO', pt: 'RESULTADO', tr: 'SONUÇ', de: 'ERGEBNIS', fr: 'RÉSULTAT' },
  'TIME UP': { ru: 'ВРЕМЯ ВЫШЛО', es: 'TIEMPO AGOTADO', pt: 'TEMPO ESGOTADO', tr: 'SÜRE DOLDU', de: 'ZEIT ABGELAUFEN', fr: 'TEMPS ÉCOULÉ' },
  RULES: { ru: 'ПРАВИЛА', es: 'REGLAS', pt: 'REGRAS', tr: 'KURALLAR', de: 'REGELN', fr: 'RÈGLES' },
  CLEARED: { ru: 'ПРОЙДЕНО', es: 'SUPERADO', pt: 'CONCLUÍDO', tr: 'TAMAMLANDI', de: 'GESCHAFFT', fr: 'TERMINÉ' },
  LANGUAGE: { ru: 'ЯЗЫК', es: 'IDIOMA', pt: 'IDIOMA', tr: 'DİL', de: 'SPRACHE', fr: 'LANGUE' },
  FAILED: { ru: 'НЕУДАЧА', es: 'FALLIDO', pt: 'FALHOU', tr: 'BAŞARISIZ', de: 'GESCHEITERT', fr: 'ÉCHEC' },
  'NEW RECORD': { ru: 'НОВЫЙ РЕКОРД', es: 'NUEVO RÉCORD', pt: 'NOVO RECORDE', tr: 'YENİ REKOR', de: 'NEUER REKORD', fr: 'NOUVEAU RECORD' },
  // The commands.
  RESUME: { ru: 'ПРОДОЛЖИТЬ', es: 'CONTINUAR', pt: 'CONTINUAR', tr: 'DEVAM ET', de: 'FORTSETZEN', fr: 'REPRENDRE' },
  RESTART: { ru: 'ЗАНОВО', es: 'REINICIAR', pt: 'REINICIAR', tr: 'YENİDEN BAŞLAT', de: 'NEUSTART', fr: 'RECOMMENCER' },
  AGAIN: { ru: 'ЕЩЁ РАЗ', es: 'OTRA VEZ', pt: 'DE NOVO', tr: 'TEKRAR', de: 'NOCHMAL', fr: 'ENCORE' },
  MENU: { ru: 'МЕНЮ', es: 'MENÚ', pt: 'MENU', tr: 'MENÜ', de: 'MENÜ', fr: 'MENU' },
  BACK: { ru: 'НАЗАД', es: 'ATRÁS', pt: 'VOLTAR', tr: 'GERİ', de: 'ZURÜCK', fr: 'RETOUR' },
  NEXT: { ru: 'ДАЛЬШЕ', es: 'SIGUIENTE', pt: 'PRÓXIMO', tr: 'SONRAKİ', de: 'WEITER', fr: 'SUIVANT' },
  EXIT: { ru: 'ВЫХОД', es: 'SALIR', pt: 'SAIR', tr: 'ÇIKIŞ', de: 'BEENDEN', fr: 'QUITTER' },
  START: { ru: 'НАЧАТЬ', es: 'EMPEZAR', pt: 'COMEÇAR', tr: 'BAŞLA', de: 'START', fr: 'COMMENCER' },
  UNDO: { ru: 'ОТМЕНИТЬ', es: 'DESHACER', pt: 'DESFAZER', tr: 'GERİ AL', de: 'RÜCKGÄNGIG', fr: 'ANNULER' },
  REGISTER: { ru: 'РЕГИСТРАЦИЯ', es: 'REGISTRARSE', pt: 'REGISTRAR', tr: 'KAYDOL', de: 'ANMELDEN', fr: "S'INSCRIRE" },
  SHARE: { ru: 'ПОДЕЛИТЬСЯ', es: 'COMPARTIR', pt: 'COMPARTILHAR', tr: 'PAYLAŞ', de: 'TEILEN', fr: 'PARTAGER' },
  COPIED: { ru: 'СКОПИРОВАНО', es: 'COPIADO', pt: 'COPIADO', tr: 'KOPYALANDI', de: 'KOPIERT', fr: 'COPIÉ' },
  SENT: { ru: 'ОТПРАВЛЕНО', es: 'ENVIADO', pt: 'ENVIADO', tr: 'GÖNDERİLDİ', de: 'GESENDET', fr: 'ENVOYÉ' },
  SKIP: { ru: 'ПРОПУСТИТЬ', es: 'SALTAR', pt: 'PULAR', tr: 'ATLA', de: 'ÜBERSPRINGEN', fr: 'PASSER' },
  // The readings of a result and of the log.
  SCORE: { ru: 'СЧЁТ', es: 'PUNTOS', pt: 'PONTOS', tr: 'PUAN', de: 'PUNKTE', fr: 'SCORE' },
  BEST: { ru: 'РЕКОРД', es: 'MEJOR', pt: 'MELHOR', tr: 'EN İYİ', de: 'BESTWERT', fr: 'MEILLEUR' },
  'MAX CHAIN': { ru: 'МАКС. ЦЕПОЧКА', es: 'CADENA MÁX.', pt: 'CORRENTE MÁX.', tr: 'EN UZUN ZİNCİR', de: 'LÄNGSTE KETTE', fr: 'CHAÎNE MAX.' },
  TIME: { ru: 'ВРЕМЯ', es: 'TIEMPO', pt: 'TEMPO', tr: 'SÜRE', de: 'ZEIT', fr: 'TEMPS' },
  MOVES: { ru: 'ХОДЫ', es: 'MOVIMIENTOS', pt: 'JOGADAS', tr: 'HAMLE', de: 'ZÜGE', fr: 'COUPS' },
  FEWEST: { ru: 'МИНИМУМ', es: 'MÍNIMO', pt: 'MÍNIMO', tr: 'EN AZ', de: 'MINIMUM', fr: 'MINIMUM' },
  'MOVES LEFT': { ru: 'ОСТАЛОСЬ ХОДОВ', es: 'RESTANTES', pt: 'RESTANTES', tr: 'KALAN HAMLE', de: 'ZÜGE ÜBRIG', fr: 'COUPS RESTANTS' },
  TODAY: { ru: 'СЕГОДНЯ', es: 'HOY', pt: 'HOJE', tr: 'BUGÜN', de: 'HEUTE', fr: "AUJOURD'HUI" },
  RANK: { ru: 'МЕСТО', es: 'PUESTO', pt: 'POSIÇÃO', tr: 'SIRA', de: 'RANG', fr: 'RANG' },
  LIMITED: { ru: 'ДНЕВНОЙ', es: 'DIARIA', pt: 'DIÁRIA', tr: 'GÜNLÜK', de: 'TÄGLICH', fr: 'DU JOUR' },
  'NO ENTRY': { ru: 'НЕТ ЗАПИСЕЙ', es: 'SIN REGISTROS', pt: 'SEM REGISTROS', tr: 'KAYIT YOK', de: 'KEINE EINTRÄGE', fr: 'AUCUNE ENTRÉE' },
  'NO NAME': { ru: 'БЕЗ ИМЕНИ', es: 'SIN NOMBRE', pt: 'SEM NOME', tr: 'İSİMSİZ', de: 'OHNE NAMEN', fr: 'SANS NOM' },
  YOU: { ru: 'ТЫ', es: 'TÚ', pt: 'VOCÊ', tr: 'SEN', de: 'DU', fr: 'TOI' },
  LOCKED: { ru: 'ЗАКРЫТО', es: 'BLOQUEADO', pt: 'BLOQUEADO', tr: 'KİLİTLİ', de: 'GESPERRT', fr: 'VERROUILLÉ' },
  STARS: { ru: 'ЗВЁЗДЫ', es: 'ESTRELLAS', pt: 'ESTRELAS', tr: 'YILDIZ', de: 'STERNE', fr: 'ÉTOILES' },
  // The settings and their values.
  SOUND: { ru: 'ЗВУК', es: 'SONIDO', pt: 'SOM', tr: 'SES', de: 'TON', fr: 'SON' },
  MOTION: { ru: 'ДВИЖЕНИЕ', es: 'MOVIMIENTO', pt: 'MOVIMENTO', tr: 'HAREKET', de: 'BEWEGUNG', fr: 'MOUVEMENT' },
  SHAKE: { ru: 'ТРЯСКА', es: 'SACUDIDA', pt: 'TREMOR', tr: 'SARSINTI', de: 'WACKELN', fr: 'SECOUSSE' },
  BACKDROP: { ru: 'ФОН', es: 'FONDO', pt: 'FUNDO', tr: 'ARKA PLAN', de: 'HINTERGRUND', fr: 'DÉCOR' },
  CONTROL: { ru: 'УПРАВЛЕНИЕ', es: 'CONTROL', pt: 'CONTROLE', tr: 'KONTROL', de: 'STEUERUNG', fr: 'COMMANDES' },
  CAMERA: { ru: 'КАМЕРА', es: 'CÁMARA', pt: 'CÂMERA', tr: 'KAMERA', de: 'KAMERA', fr: 'CAMÉRA' },
  ON: { ru: 'ВКЛ', es: 'SÍ', pt: 'SIM', tr: 'AÇIK', de: 'AN', fr: 'OUI' },
  OFF: { ru: 'ВЫКЛ', es: 'NO', pt: 'NÃO', tr: 'KAPALI', de: 'AUS', fr: 'NON' },
  FULL: { ru: 'ПОЛНОЕ', es: 'COMPLETO', pt: 'COMPLETO', tr: 'TAM', de: 'VOLL', fr: 'COMPLET' },
  LESS: { ru: 'МЕНЬШЕ', es: 'REDUCIDO', pt: 'REDUZIDO', tr: 'AZ', de: 'WENIGER', fr: 'RÉDUIT' },
  SWIPE: { ru: 'СВАЙПЫ', es: 'GESTOS', pt: 'GESTOS', tr: 'KAYDIRMA', de: 'WISCHEN', fr: 'GESTES' },
  BUTTONS: { ru: 'КНОПКИ', es: 'BOTONES', pt: 'BOTÕES', tr: 'DÜĞMELER', de: 'TASTEN', fr: 'BOUTONS' },
  AUTO: { ru: 'АВТО', es: 'AUTO', pt: 'AUTO', tr: 'OTO', de: 'AUTO', fr: 'AUTO' },
  FIXED: { ru: 'ВСЁ ПОЛЕ', es: 'FIJA', pt: 'FIXA', tr: 'SABİT', de: 'FEST', fr: 'FIXE' },
} as const satisfies Record<string, Record<'ru' | 'es' | 'pt' | 'tr' | 'de' | 'fr', string>>;
