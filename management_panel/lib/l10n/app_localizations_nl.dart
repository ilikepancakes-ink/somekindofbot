// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Dutch Flemish (`nl`).
class AppLocalizationsNl extends AppLocalizations {
  AppLocalizationsNl([String locale = 'nl']) : super(locale);

  @override
  String get appTitle => 'Bot Beheer';

  @override
  String get loginTitle => 'Bot Beheer';

  @override
  String get loginInstructions => 'Gebruik het /generate-token commando in Discord om je auth token te krijgen.';

  @override
  String get authTokenLabel => 'Auth Token';

  @override
  String get authTokenHint => 'Plak je auth token hier';

  @override
  String get loginButton => 'Inloggen';

  @override
  String get serverSelect => 'Selecteer Server';

  @override
  String get timeoutsTab => 'Time-outs';

  @override
  String get bansTab => 'Verbanningen';

  @override
  String get warnsTab => 'Waarschuwingen';

  @override
  String get rolesTab => 'Rollen';

  @override
  String get membersTab => 'Leden';

  @override
  String get envVarsTab => 'Omgevingsvariabelen';

  @override
  String get actionsTab => 'Acties';

  @override
  String get updateBot => 'Update Bot';

  @override
  String get restartBot => 'Herstart Bot';

  @override
  String get settings => 'Instellingen';

  @override
  String get theme => 'Thema';

  @override
  String get language => 'Taal';

  @override
  String get lightMode => 'Lichte Modus';

  @override
  String get darkMode => 'Donkere Modus';

  @override
  String get systemMode => 'Systeem Modus';

  @override
  String get english => 'Engels';

  @override
  String get dutch => 'Nederlands';

  @override
  String get russian => 'Russisch';
}
