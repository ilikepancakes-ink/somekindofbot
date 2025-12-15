// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Bot Management';

  @override
  String get loginTitle => 'Bot Management';

  @override
  String get loginInstructions => 'Use the /generate-token command in Discord to get your auth token.';

  @override
  String get authTokenLabel => 'Auth Token';

  @override
  String get authTokenHint => 'Paste your auth token here';

  @override
  String get loginButton => 'Login';

  @override
  String get serverSelect => 'Select Server';

  @override
  String get timeoutsTab => 'Timeouts';

  @override
  String get bansTab => 'Bans';

  @override
  String get warnsTab => 'Warns';

  @override
  String get rolesTab => 'Roles';

  @override
  String get membersTab => 'Members';

  @override
  String get envVarsTab => 'Env Vars';

  @override
  String get actionsTab => 'Actions';

  @override
  String get updateBot => 'Update Bot';

  @override
  String get restartBot => 'Restart Bot';

  @override
  String get settings => 'Settings';

  @override
  String get theme => 'Theme';

  @override
  String get language => 'Language';

  @override
  String get lightMode => 'Light Mode';

  @override
  String get darkMode => 'Dark Mode';

  @override
  String get systemMode => 'System Mode';

  @override
  String get english => 'English';

  @override
  String get dutch => 'Dutch';

  @override
  String get russian => 'Russian';
}
