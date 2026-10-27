/// Current app language (ar | en | ur). Pure Dart so the API client can send it (header x-lang).
class LangState {
  LangState._();
  static String code = 'ar';
  static bool get isRtl => code != 'en';
}
