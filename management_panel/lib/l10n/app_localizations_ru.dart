// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appTitle => 'Управление Ботом';

  @override
  String get loginTitle => 'Управление Ботом';

  @override
  String get loginInstructions => 'Используйте команду /generate-token в Discord, чтобы получить токен аутентификации.';

  @override
  String get authTokenLabel => 'Токен Аутентификации';

  @override
  String get authTokenHint => 'Вставьте ваш токен аутентификации здесь';

  @override
  String get loginButton => 'Войти';

  @override
  String get serverSelect => 'Выбрать Сервер';

  @override
  String get timeoutsTab => 'Тайм-ауты';

  @override
  String get bansTab => 'Баны';

  @override
  String get warnsTab => 'Предупреждения';

  @override
  String get rolesTab => 'Роли';

  @override
  String get membersTab => 'Участники';

  @override
  String get envVarsTab => 'Переменные Окружения';

  @override
  String get actionsTab => 'Действия';

  @override
  String get updateBot => 'Обновить Бота';

  @override
  String get restartBot => 'Перезапустить Бота';

  @override
  String get settings => 'Настройки';

  @override
  String get theme => 'Тема';

  @override
  String get language => 'Язык';

  @override
  String get lightMode => 'Светлая Тема';

  @override
  String get darkMode => 'Тёмная Тема';

  @override
  String get systemMode => 'Системная Тема';

  @override
  String get english => 'Английский';

  @override
  String get dutch => 'Нидерландский';

  @override
  String get russian => 'Русский';
}
